import node from "@platform/eslint-config/node";

export default [...node, { ignores: ["dist", "src/generated"] }];
