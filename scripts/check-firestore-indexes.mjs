import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const repositoryRoot = process.cwd();
const databaseDirectory = join(repositoryRoot, "db");
const indexesPath = join(repositoryRoot, "firestore.indexes.json");
const indexTagPattern = /@firestore-index\s+(\S+)\s+([^*\n]+)/g;
const whereFieldPattern = /\.where\(\s*["']([^"']+)["']/g;
const orderByFieldPattern =
  /\.orderBy\(\s*["']([^"']+)["']\s*(?:,\s*["']([^"']+)["'])?/g;
const queryMethodPattern = /(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)/g;

async function getDatabaseFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await getDatabaseFiles(entryPath)));
    } else if (entry.name.endsWith(".db.ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

function normalizeFields(fields) {
  return fields
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
}

function getIndexKey(collectionGroup, fields) {
  return `${collectionGroup}:${fields.join(",")}`;
}

function getConfiguredIndexes(indexesDocument) {
  return new Map(
    indexesDocument.indexes.map((index) => [
      getIndexKey(
        index.collectionGroup,
        index.fields.map((field) => field.fieldPath),
      ),
      index,
    ]),
  );
}

function getFunctionRanges(source) {
  const matches = [...source.matchAll(queryMethodPattern)];

  return matches.map((match, index) => {
    const start = source.lastIndexOf("/**", match.index);
    const nextFunction = matches[index + 1];
    const end = nextFunction
      ? source.lastIndexOf("/**", nextFunction.index)
      : source.length;

    return { start, end };
  });
}

function getIndexTags(source, range) {
  const functionSource = source.slice(range.start, range.end);
  return [...functionSource.matchAll(indexTagPattern)].map((match) => ({
    collectionGroup: match[1],
    fields: normalizeFields(match[2]),
  }));
}

function getQueryFields(source, range) {
  const functionSource = source.slice(range.start, range.end);
  const whereFields = [...functionSource.matchAll(whereFieldPattern)].map(
    (match) => match[1],
  );
  const orderByFields = [...functionSource.matchAll(orderByFieldPattern)].map(
    (match) => ({
      field: match[1],
      direction: match[2]?.toLowerCase() === "asc" ? "ASCENDING" : "DESCENDING",
    }),
  );

  return { whereFields, orderByFields };
}

function formatLocation(filePath, source, offset) {
  const line = source.slice(0, offset).split("\n").length;
  return `${filePath}:${line}`;
}

async function main() {
  const indexesDocument = JSON.parse(await readFile(indexesPath, "utf8"));
  const configuredIndexes = getConfiguredIndexes(indexesDocument);
  const errors = [];

  for (const filePath of await getDatabaseFiles(databaseDirectory)) {
    const source = await readFile(filePath, "utf8");
    const relativePath = filePath.slice(repositoryRoot.length + 1);

    for (const range of getFunctionRanges(source)) {
      const { whereFields, orderByFields } = getQueryFields(source, range);

      if (
        orderByFields.length === 0 ||
        whereFields.length === 0 ||
        whereFields.every((field) =>
          orderByFields.some((orderByField) => orderByField.field === field),
        )
      ) {
        continue;
      }

      const queryFields = [
        ...new Set([...whereFields, ...orderByFields.map((field) => field.field)]),
      ];

      const tags = getIndexTags(source, range);
      const tagFields = new Set(tags.flatMap((tag) => tag.fields));

      for (const field of queryFields) {
        if (!tagFields.has(field)) {
          errors.push(
            `${formatLocation(relativePath, source, range.start)}: query field "${field}" is missing from a @firestore-index declaration`,
          );
        }
      }

      for (const tag of tags) {
        const key = getIndexKey(tag.collectionGroup, tag.fields);
        const configuredIndex = configuredIndexes.get(key);

        if (!configuredIndex) {
          errors.push(
            `${formatLocation(relativePath, source, range.start)}: missing index ${key} from firestore.indexes.json`,
          );
          continue;
        }

        for (const orderByField of orderByFields) {
          const indexField = configuredIndex.fields.at(-1);

          if (
            indexField?.fieldPath !== orderByField.field ||
            indexField.order !== orderByField.direction
          ) {
            errors.push(
              `${formatLocation(relativePath, source, range.start)}: index ${key} does not match orderBy(${orderByField.field}, ${orderByField.direction.toLowerCase()})`,
            );
          }
        }
      }

      if (tags.length === 0) {
        errors.push(
          `${formatLocation(relativePath, source, range.start)}: ordered query is missing @firestore-index declarations`,
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error("Firestore index contract check failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("Firestore index contract check passed.");
}

await main();
