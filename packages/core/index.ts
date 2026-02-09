import { Type, type TSchema } from "@sinclair/typebox";

export interface Model {
    provider: string;
    name: string;
}

// Tool 接口定义
export interface Tool {
    name: string;
    description: string;
    parameters: TSchema;
}

export function getModel(provider: string, modelName: string): Model {
    return {
        provider,
        name: modelName
    };
}

// StringEnum 辅助函数，用于创建字符串枚举 schema
export function StringEnum<T extends string[]>(values: [...T]) {
    return Type.Union(values.map(v => Type.Literal(v)));
}