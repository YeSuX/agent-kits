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

// 内容块类型
export type TextBlock = {
    type: 'text';
    text: string;
};

export type ToolCallBlock = {
    type: 'toolCall';
    id: string;
    name: string;
    arguments: Record<string, any>;
};

export type ContentBlock = TextBlock | ToolCallBlock;

// 消息类型
export type UserMessage = {
    role: 'user';
    content: string;
};

export type AssistantMessage = {
    role: 'assistant';
    content: ContentBlock[];
};

export type ToolResultMessage = {
    role: 'toolResult';
    toolCallId: string;
    toolName: string;
    content: ContentBlock[];
    isError: boolean;
    timestamp: number;
};

export type Message = UserMessage | AssistantMessage | ToolResultMessage;

// Context 类型
export interface Context {
    systemPrompt: string;
    messages: Message[];
    tools?: Tool[];
}

export function isToolCallBlock(block: ContentBlock): block is ToolCallBlock {
    return block.type === 'toolCall';
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