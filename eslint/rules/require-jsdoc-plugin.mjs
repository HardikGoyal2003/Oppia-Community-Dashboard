function getJSDocComment(sourceCode, node) {
  const comments = sourceCode.getCommentsBefore(node);
  const comment = comments[comments.length - 1];

  if (!comment || comment.type !== "Block" || !comment.value.startsWith("*")) {
    return null;
  }

  if (comment.loc.end.line !== node.loc.start.line - 1) {
    return null;
  }

  return comment;
}

function getCommentTargetNode(node) {
  return node.parent?.type === "ExportNamedDeclaration" ? node.parent : node;
}

function getJSDocLines(comment) {
  return comment.value
    .split("\n")
    .map((line) => line.replace(/^\s*\*?\s?/, "").trim());
}

function getDescription(lines) {
  return lines.find((line) => line.length > 0 && !line.startsWith("@")) ?? "";
}

function getParamNames(param) {
  switch (param.type) {
    case "Identifier":
      return [param.name];
    case "AssignmentPattern":
      return getParamNames(param.left);
    case "RestElement":
      return getParamNames(param.argument);
    case "ObjectPattern":
      return ["object"];
    case "ArrayPattern":
      return ["array"];
    default:
      return [];
  }
}

function getJSDocParamNames(lines) {
  return lines
    .filter((line) => line.startsWith("@param"))
    .map((line) => {
      const match = line.match(/^@param\s+(?:\{[^}]+\}\s*)?([^\s]+)/);
      return match?.[1] ?? "";
    })
    .filter(Boolean);
}

function hasReturnsTag(lines) {
  return lines.some((line) => /^@returns?\b/.test(line));
}

function createMissingJSDocReport(context, node, kind) {
  context.report({
    node,
    message: `${kind} must include a JSDoc block.`,
  });
}

const requireJSDocRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require complete JSDoc blocks for functions and exported classes.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function validateFunction(node) {
      const commentTarget = getCommentTargetNode(node);
      const comment = getJSDocComment(sourceCode, commentTarget);

      if (!comment) {
        createMissingJSDocReport(context, commentTarget, "Function");
        return;
      }

      const lines = getJSDocLines(comment);
      const description = getDescription(lines);

      if (!description) {
        context.report({
          node,
          message: "Function JSDoc must include a description.",
        });
      }

      const expectedParams = node.params.flatMap(getParamNames);
      const actualParams = getJSDocParamNames(lines);
      const missingParams = expectedParams.filter(
        (name) => !actualParams.includes(name),
      );

      if (missingParams.length > 0) {
        context.report({
          node,
          message: `Function JSDoc is missing @param tags for: ${missingParams.join(", ")}.`,
        });
      }

      if (!hasReturnsTag(lines)) {
        context.report({
          node,
          message: "Function JSDoc must include an @returns tag.",
        });
      }
    }

    function validateClass(node) {
      const commentTarget = getCommentTargetNode(node);
      const comment = getJSDocComment(sourceCode, commentTarget);

      if (!comment) {
        createMissingJSDocReport(context, commentTarget, "Class");
        return;
      }

      const lines = getJSDocLines(comment);
      const description = getDescription(lines);

      if (!description) {
        context.report({
          node,
          message: "Class JSDoc must include a description.",
        });
      }
    }

    return {
      FunctionDeclaration: validateFunction,
      ClassDeclaration: validateClass,
    };
  },
};

const requireJsdocPlugin = {
  rules: {
    "require-jsdoc": requireJSDocRule,
  },
};

export default requireJsdocPlugin;
