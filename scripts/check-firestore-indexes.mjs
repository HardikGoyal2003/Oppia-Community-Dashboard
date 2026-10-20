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

/**
 * Recursively lists database-layer files that contain Firestore queries.
 *
 * @param {string} directory The directory to search.
 * @returns {Promise<string[]>} The database-layer file paths.
 */
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

/**
 * Splits and normalizes a comma-separated index field list.
 *
 * @param {string} fields The comma-separated field list.
 * @returns {string[]} The normalized field names.
 */
function normalizeFields(fields) {
  return fields
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
}

/**
 * Builds a stable key for an index definition.
 *
 * @param {string} collectionGroup The Firestore collection group.
 * @param {string[]} fields The ordered index fields.
 * @returns {string} The index key.
 */
function getIndexKey(collectionGroup, fields) {
  return `${collectionGroup}:${fields.join(",")}`;
}

/**
 * Indexes the configured Firestore definitions by collection and field order.
 *
 * @param indexesDocument The parsed index configuration.
 * @returns {Map<string, object>} The configured indexes by stable key.
 */
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

/**
 * Finds source ranges belonging to individual database functions.
 *
 * @param {string} source The database source code.
 * @returns {Array<{start: number, end: number}>} The function source ranges.
 */
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

/**
 * Extracts Firestore index contract tags from a function range.
 *
 * @param {string} source The database source code.
 * @param range The function source range.
 * @returns {Array<{collectionGroup: string, fields: string[]}>} The declared index contracts.
 */
function getIndexTags(source, range) {
  const functionSource = source.slice(range.start, range.end);
  return [...functionSource.matchAll(indexTagPattern)].map((match) => ({
    collectionGroup: match[1],
    fields: normalizeFields(match[2]),
  }));
}

/**
 * Extracts filter and ordering fields from a function range.
 *
 * @param {string} source The database source code.
 * @param range The function source range.
 * @returns {{whereFields: string[], orderByFields: Array<{field: string, direction: string}>}} The query fields.
 */
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

/**
 * Formats a source location for a validation error.
 *
 * @param {string} filePath The repository-relative file path.
 * @param {string} source The file source code.
 * @param {number} offset The source character offset.
 * @returns {string} The formatted file and line location.
 */
function formatLocation(filePath, source, offset) {
  const line = source.slice(0, offset).split("\n").length;
  return `${filePath}:${line}`;
}

/**
 * Validates database query contracts against Firestore index configuration.
 *
 * @returns {Promise<void>} A promise that resolves after validation completes.
 */
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
