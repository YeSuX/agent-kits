import { Type, type TSchema } from "@sinclair/typebox";
import OpenAI from "openai";

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

export interface StreamEvent {
    type: 'start' | 'text_start' | 'text_delta' | 'text_end' |
    'thinking_start' | 'thinking_delta' | 'thinking_end' |
    'toolcall_start' | 'toolcall_end' | 'done' | 'error';
    [key: string]: any;
}

export interface StreamReturn extends AsyncIterable<StreamEvent> {
    result(): Promise<AssistantMessage & { usage: any }>;
}

export function stream(model: Model, context: Context): StreamReturn {
    console.log('API_KEY', process.env.API_KEY);
    console.log('BASE_URL', process.env.BASE_URL);

    const openai = new OpenAI({
        apiKey: process.env.API_KEY,
        baseURL: process.env.BASE_URL,
    })

    let finalMessage: AssistantMessage | null = null;
    let usage: any = null;

    const iterator = async function* (): AsyncGenerator<StreamEvent> {
        try {
            yield {
                type: 'start',
                partial: {
                    model: model.name,
                }
            }

            const messages = [
                {
                    role: 'system',
                    content: context.systemPrompt,
                },
                ...context.messages.map(m => ({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: m.role === 'user' ? m.content : m.content.map(c => c.type === 'text' ? c.text : '').join('\n'),
                }))
            ]

            console.log('---messages---', messages);

            console.log('---model---', model.name);

            const response = await openai.chat.completions.create({
                model: model.name,
                messages: messages as any,
                stream: true,
                stream_options: {
                    include_usage: true,
                },
                tools: context.tools?.map(t => ({
                    type: 'function',
                    function: {
                        name: t.name,
                        description: t.description,
                        parameters: t.parameters
                    }
                }))
            })

            const contentBlocks: ContentBlock[] = [];
            let currentText = ''

            yield { type: 'text_start' };

            for await (const chunk of response) {
                // console.log('---chunk---', chunk);

                const delta = chunk.choices[0]?.delta
                // console.log('---delta---', delta);

                if (delta?.content) {
                    yield {
                        type: 'text_delta',
                        delta: delta.content
                    };
                    currentText += delta.content;
                }

                if (delta?.tool_calls) {
                    for (const toolCall of delta.tool_calls) {
                        yield {
                            type: 'toolcall_start',
                            contentIndex: contentBlocks.length
                        };
                        // 处理 tool call...
                    }
                }

                if (chunk.usage) {
                    usage = {
                        input: chunk.usage.prompt_tokens,
                        output: chunk.usage.completion_tokens,
                        cost: {
                            total: chunk.usage.total_tokens // 计算实际费用
                        },
                        // @ts-ignore
                        cached: chunk.usage.cached_tokens,
                    };
                }

            }

            yield { type: 'text_end' };

            if (currentText) {
                contentBlocks.push({ type: 'text', text: currentText });
            }

            finalMessage = {
                role: 'assistant',
                content: contentBlocks
            };

            yield {
                type: 'done',
                reason: 'stop'
            };

        } catch (error) {
            yield {
                type: 'error',
                error
            };

        }

    }

    console.log('---finalMessage---', finalMessage);
    console.log('---usage---', usage);


    return {
        [Symbol.asyncIterator]: iterator,
        async result() {
            if (!finalMessage) {
                for await (const _ of this) {
                    // 消费事件
                }
            }

            return { ...finalMessage!, usage }
        }
    }
}

export async function complete(model: Model, context: Context): Promise<AssistantMessage> {
    const openai = new OpenAI({
        apiKey: process.env.API_KEY,
        baseURL: process.env.BASE_URL,
    })

    // 构建消息
    const messages = [
        {
            role: 'system',
            content: context.systemPrompt,
        },
        ...context.messages.map(m => {
            if (m.role === 'user') {
                return { role: 'user', content: m.content };
            } else if (m.role === 'assistant') {
                return {
                    role: 'assistant',
                    content: m.content.map(c => c.type === 'text' ? c.text : '').join('\n'),
                };
            }
            // 处理 toolResult...
        })
    ];

    // 调用 API
    const response = await openai.chat.completions.create({
        model: model.name,
        messages: messages as any,
        tools: context.tools?.map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }
        }))
    });

    // 转换响应
    const contentBlocks: ContentBlock[] = [];

    const choice = response.choices[0]!;

    console.log('---response---', response);


    if (choice.message.content) {
        contentBlocks.push({
            type: 'text',
            text: choice.message.content,
        });
    }

    if (choice.message.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
            console.log('---toolCall---', toolCall);

            contentBlocks.push({
                type: 'toolCall',
                id: toolCall.id,
                name: toolCall.function.name,
                arguments: JSON.parse(toolCall.function.arguments)
            });
        }
    }

    console.log('---contentBlocks---', contentBlocks);


    return {
        role: 'assistant',
        content: contentBlocks,
        usage: {
            input: response.usage?.prompt_tokens,
            output: response.usage?.completion_tokens,
            cost: {
                total: response.usage?.total_tokens
            },
            // @ts-ignore
            cached: response.usage?.cached_tokens,
        }
    }
}