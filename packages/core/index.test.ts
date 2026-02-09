import { test, expect, describe, mock, beforeEach } from 'bun:test';
import { getModel, stream, StringEnum, type Context, type Tool, type ToolResultMessage, type UserMessage } from './index';
import { Type } from '@sinclair/typebox';

describe('getModel', () => {
  test('should return a model instance with correct provider and model name', () => {
    const model = getModel('kimi', 'kimi-k2.5');
    
    expect(model).toBeDefined();
    expect(model.provider).toBe('kimi');
    expect(model.name).toBe('kimi-k2.5');
  });

  test('should support different providers', () => {
    const models = [
      getModel('openai', 'gpt-4'),
      getModel('anthropic', 'claude-3-opus'),
      getModel('kimi', 'kimi-k2.5')
    ];

    models.forEach(model => {
      expect(model).toBeDefined();
      expect(model.provider).toBeTruthy();
      expect(model.name).toBeTruthy();
    });
  });
});

describe('Tool definition', () => {
  test('should create tool with TypeBox schema', () => {
    const tool: Tool = {
      name: 'get_time',
      description: 'Get the current time',
      parameters: Type.Object({
        timezone: Type.Optional(Type.String({ description: 'Optional timezone' }))
      })
    };

    expect(tool.name).toBe('get_time');
    expect(tool.description).toBe('Get the current time');
    expect(tool.parameters).toBeDefined();
  });

  test('should support multiple parameter types', () => {
    const weatherTool: Tool = {
      name: 'get_weather',
      description: 'Get weather information',
      parameters: Type.Object({
        location: Type.String({ description: 'City name' }),
        units: Type.Optional(StringEnum(['celsius', 'fahrenheit'])),
        includeForecast: Type.Optional(Type.Boolean())
      })
    };

    expect(weatherTool.parameters).toBeDefined();
  });
});

describe('Context', () => {
  test('should build a valid context object', () => {
    const tools: Tool[] = [{
      name: 'test_tool',
      description: 'A test tool',
      parameters: Type.Object({})
    }];

    const context: Context = {
      systemPrompt: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Hello' }],
      tools
    };

    expect(context.systemPrompt).toBe('You are a helpful assistant.');
    expect(context.messages).toHaveLength(1);
    expect((context.messages[0] as UserMessage).role).toBe('user');
    expect(context.tools).toHaveLength(1);
  });

  test('should support message history', () => {
    const context: Context = {
      systemPrompt: 'You are a helpful assistant.',
      messages: [
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: [{ type: 'text', text: 'First answer' }] },
        { role: 'user', content: 'Second question' }
      ]
    };

    expect(context.messages).toHaveLength(3);
  });

  test('should support tool result messages', () => {
    const context: Context = {
      systemPrompt: 'You are a helpful assistant.',
      messages: [
        { role: 'user', content: 'What time is it?' },
        {
          role: 'assistant',
          content: [{
            type: 'toolCall',
            id: 'call_123',
            name: 'get_time',
            arguments: { timezone: 'UTC' }
          }]
        },
        {
          role: 'toolResult',
          toolCallId: 'call_123',
          toolName: 'get_time',
          content: [{ type: 'text', text: '2024-01-01 12:00:00 UTC' }],
          isError: false,
          timestamp: Date.now()
        }
      ]
    };

    const toolResult = context.messages[2] as ToolResultMessage;
    expect(toolResult.role).toBe('toolResult');
    expect(toolResult.toolCallId).toBe('call_123');
    expect(toolResult.isError).toBe(false);
  });
});

describe('stream', () => {
  let model: ReturnType<typeof getModel>;
  let context: Context;

  beforeEach(() => {
    model = getModel('kimi', 'kimi-k2.5');
    context = {
      systemPrompt: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Hello' }]
    };
  });

  test.skip('should emit start event', async () => {
    const s = stream(model, context);
    const events: any[] = [];

    for await (const event of s) {
      events.push(event);
    }

    const startEvent = events.find(e => e.type === 'start');
    expect(startEvent).toBeDefined();
    expect(startEvent.partial.model).toBeDefined();
  });

  test.skip('should emit text events in correct order', async () => {
    const s = stream(model, context);
    const textEvents: string[] = [];

    for await (const event of s) {
      if (event.type === 'text_start' || event.type === 'text_delta' || event.type === 'text_end') {
        textEvents.push(event.type);
      }
    }

    // 应该按照 start -> delta... -> end 的顺序
    expect(textEvents[0]).toBe('text_start');
    expect(textEvents[textEvents.length - 1]).toBe('text_end');
  });

  // test('should accumulate text deltas', async () => {
  //   const s = stream(model, context);
  //   let accumulatedText = '';

  //   for await (const event of s) {
  //     if (event.type === 'text_delta') {
  //       accumulatedText += event.delta;
  //     }
  //   }

  //   expect(accumulatedText.length).toBeGreaterThan(0);
  // });

  // test('should handle thinking events', async () => {
  //   const s = stream(model, context);
  //   const thinkingEvents: string[] = [];

  //   for await (const event of s) {
  //     if (event.type.startsWith('thinking_')) {
  //       thinkingEvents.push(event.type);
  //     }
  //   }

  //   // 如果有 thinking，应该是 start -> delta... -> end
  //   if (thinkingEvents.length > 0) {
  //     expect(thinkingEvents[0]).toBe('thinking_start');
  //     expect(thinkingEvents[thinkingEvents.length - 1]).toBe('thinking_end');
  //   }
  // });

  // test('should handle toolcall events', async () => {
  //   const contextWithTools: Context = {
  //     systemPrompt: 'You are a helpful assistant.',
  //     messages: [{ role: 'user', content: 'What time is it?' }],
  //     tools: [{
  //       name: 'get_time',
  //       description: 'Get the current time',
  //       parameters: Type.Object({
  //         timezone: Type.Optional(Type.String())
  //       })
  //     }]
  //   };

  //   const s = stream(model, contextWithTools);
  //   const toolcallEvents: any[] = [];

  //   for await (const event of s) {
  //     if (event.type.startsWith('toolcall_')) {
  //       toolcallEvents.push(event);
  //     }
  //   }

  //   if (toolcallEvents.length > 0) {
  //     const startEvent = toolcallEvents.find(e => e.type === 'toolcall_start');
  //     const endEvent = toolcallEvents.find(e => e.type === 'toolcall_end');

  //     expect(startEvent).toBeDefined();
  //     expect(startEvent.contentIndex).toBeGreaterThanOrEqual(0);
      
  //     if (endEvent) {
  //       expect(endEvent.toolCall.name).toBeTruthy();
  //       expect(endEvent.toolCall.arguments).toBeDefined();
  //     }
  //   }
  // });

  // test('should emit done event with reason', async () => {
  //   const s = stream(model, context);
  //   let doneEvent: any;

  //   for await (const event of s) {
  //     if (event.type === 'done') {
  //       doneEvent = event;
  //     }
  //   }

  //   expect(doneEvent).toBeDefined();
  //   expect(doneEvent.reason).toBeTruthy();
  //   expect(['stop', 'length', 'tool_calls']).toContain(doneEvent.reason);
  // });

  // test('should return final message via result()', async () => {
  //   const s = stream(model, context);
    
  //   // 消费流
  //   for await (const event of s) {
  //     // 处理事件
  //   }

  //   const finalMessage = await s.result();

  //   expect(finalMessage).toBeDefined();
  //   expect(finalMessage.role).toBe('assistant');
  //   expect(finalMessage.content).toBeDefined();
  //   expect(Array.isArray(finalMessage.content)).toBe(true);
  // });

  // test('should include usage information', async () => {
  //   const s = stream(model, context);
    
  //   for await (const event of s) {
  //     // 消费流
  //   }

  //   const finalMessage = await s.result();

  //   expect(finalMessage.usage).toBeDefined();
  //   expect(finalMessage.usage.input).toBeGreaterThanOrEqual(0);
  //   expect(finalMessage.usage.output).toBeGreaterThanOrEqual(0);
  //   expect(finalMessage.usage.cost).toBeDefined();
  //   expect(finalMessage.usage.cost.total).toBeGreaterThanOrEqual(0);
  // });

  // test('should handle errors gracefully', async () => {
  //   const invalidContext: Context = {
  //     systemPrompt: '',
  //     messages: [] // 空消息可能导致错误
  //   };

  //   const s = stream(model, invalidContext);
  //   let errorEvent: any;

  //   for await (const event of s) {
  //     if (event.type === 'error') {
  //       errorEvent = event;
  //     }
  //   }

  //   // 如果发生错误，应该有 error 事件
  //   if (errorEvent) {
  //     expect(errorEvent.error).toBeDefined();
  //   }
  // });
});

// describe('complete', () => {
//   let model: ReturnType<typeof getModel>;
//   let context: Context;

//   beforeEach(() => {
//     model = getModel('kimi', 'kimi-2.5');
//     context = {
//       systemPrompt: 'You are a helpful assistant.',
//       messages: [{ role: 'user', content: 'Hello' }]
//     };
//   });

//   test('should return complete response', async () => {
//     const response = await complete(model, context);

//     expect(response).toBeDefined();
//     expect(response.role).toBe('assistant');
//     expect(response.content).toBeDefined();
//     expect(Array.isArray(response.content)).toBe(true);
//   });

//   test('should handle text responses', async () => {
//     const response = await complete(model, context);
    
//     const textBlocks = response.content.filter(b => b.type === 'text');
//     expect(textBlocks.length).toBeGreaterThan(0);
    
//     textBlocks.forEach(block => {
//       expect(block.text).toBeTruthy();
//     });
//   });

//   test('should handle tool call responses', async () => {
//     const contextWithTools: Context = {
//       systemPrompt: 'You are a helpful assistant.',
//       messages: [{ role: 'user', content: 'What time is it?' }],
//       tools: [{
//         name: 'get_time',
//         description: 'Get the current time',
//         parameters: Type.Object({
//           timezone: Type.Optional(Type.String())
//         })
//       }]
//     };

//     const response = await complete(model, contextWithTools);
    
//     const toolCallBlocks = response.content.filter(b => b.type === 'toolCall');
    
//     // 如果模型决定调用工具
//     if (toolCallBlocks.length > 0) {
//       toolCallBlocks.forEach(call => {
//         expect(call.id).toBeTruthy();
//         expect(call.name).toBeTruthy();
//         expect(call.arguments).toBeDefined();
//       });
//     }
//   });

//   test('should include usage information', async () => {
//     const response = await complete(model, context);

//     expect(response.usage).toBeDefined();
//     expect(response.usage.input).toBeGreaterThanOrEqual(0);
//     expect(response.usage.output).toBeGreaterThanOrEqual(0);
//     expect(response.usage.cost.total).toBeGreaterThanOrEqual(0);
//   });
// });

// describe('Tool execution flow', () => {
//   test('should handle complete tool execution cycle', async () => {
//     const model = getModel('kimi', 'kimi-2.5');
//     const tools: Tool[] = [{
//       name: 'get_time',
//       description: 'Get the current time',
//       parameters: Type.Object({
//         timezone: Type.Optional(Type.String())
//       })
//     }];

//     const context: Context = {
//       systemPrompt: 'You are a helpful assistant.',
//       messages: [{ role: 'user', content: 'What time is it in Tokyo?' }],
//       tools
//     };

//     // 第一次调用
//     const firstResponse = await complete(model, context);
//     context.messages.push(firstResponse);

//     const toolCalls = firstResponse.content.filter(b => b.type === 'toolCall');

//     if (toolCalls.length > 0) {
//       // 执行工具
//       for (const call of toolCalls) {
//         const result = call.name === 'get_time'
//           ? new Date().toLocaleString('en-US', {
//               timeZone: call.arguments.timezone || 'UTC',
//               dateStyle: 'full',
//               timeStyle: 'long'
//             })
//           : 'Unknown tool';

//         // 添加工具结果
//         context.messages.push({
//           role: 'toolResult',
//           toolCallId: call.id,
//           toolName: call.name,
//           content: [{ type: 'text', text: result }],
//           isError: false,
//           timestamp: Date.now()
//         });
//       }

//       // 继续对话
//       const continuation = await complete(model, context);
//       context.messages.push(continuation);

//       expect(continuation.content.length).toBeGreaterThan(0);
      
//       // 最终响应应该包含文本（不是工具调用）
//       const hasText = continuation.content.some(b => b.type === 'text');
//       expect(hasText).toBe(true);
//     }
//   });

//   test('should handle tool errors', async () => {
//     const model = getModel('kimi', 'kimi-2.5');
//     const context: Context = {
//       systemPrompt: 'You are a helpful assistant.',
//       messages: [
//         { role: 'user', content: 'What time is it?' },
//         {
//           role: 'assistant',
//           content: [{
//             type: 'toolCall',
//             id: 'call_123',
//             name: 'get_time',
//             arguments: {}
//           }]
//         },
//         {
//           role: 'toolResult',
//           toolCallId: 'call_123',
//           toolName: 'get_time',
//           content: [{ type: 'text', text: 'Error: Invalid timezone' }],
//           isError: true,
//           timestamp: Date.now()
//         }
//       ]
//     };

//     const response = await complete(model, context);

//     expect(response).toBeDefined();
//     expect(response.content.length).toBeGreaterThan(0);
//   });

//   test('should support image content in tool results', async () => {
//     const model = getModel('kimi', 'kimi-2.5');
//     const context: Context = {
//       systemPrompt: 'You are a helpful assistant.',
//       messages: [
//         { role: 'user', content: 'Show me a chart' },
//         {
//           role: 'assistant',
//           content: [{
//             type: 'toolCall',
//             id: 'call_456',
//             name: 'generate_chart',
//             arguments: { type: 'bar' }
//           }]
//         },
//         {
//           role: 'toolResult',
//           toolCallId: 'call_456',
//           toolName: 'generate_chart',
//           content: [
//             { type: 'text', text: 'Generated chart:' },
//             { type: 'image', url: 'data:image/png;base64,iVBORw0...' }
//           ],
//           isError: false,
//           timestamp: Date.now()
//         }
//       ]
//     };

//     const response = await complete(model, context);

//     expect(response).toBeDefined();
//   });
// });

// describe('Streaming with tool calls', () => {
//   test('should stream tool call execution', async () => {
//     const model = getModel('kimi', 'kimi-2.5');
//     const tools: Tool[] = [{
//       name: 'get_time',
//       description: 'Get the current time',
//       parameters: Type.Object({
//         timezone: Type.Optional(Type.String())
//       })
//     }];

//     const context: Context = {
//       systemPrompt: 'You are a helpful assistant.',
//       messages: [{ role: 'user', content: 'What time is it?' }],
//       tools
//     };

//     const s = stream(model, context);
//     const toolCallEvents: any[] = [];

//     for await (const event of s) {
//       if (event.type === 'toolcall_start' || event.type === 'toolcall_delta' || event.type === 'toolcall_end') {
//         toolCallEvents.push(event);
//       }
//     }

//     const finalMessage = await s.result();
//     context.messages.push(finalMessage);

//     const toolCalls = finalMessage.content.filter(b => b.type === 'toolCall');

//     if (toolCalls.length > 0) {
//       expect(toolCallEvents.length).toBeGreaterThan(0);
      
//       // 验证事件顺序
//       const startEvents = toolCallEvents.filter(e => e.type === 'toolcall_start');
//       const endEvents = toolCallEvents.filter(e => e.type === 'toolcall_end');
      
//       expect(startEvents.length).toBeGreaterThan(0);
//       expect(endEvents.length).toBeGreaterThan(0);
//     }
//   });
// });

// describe('Error handling', () => {
//   test('should handle invalid model', () => {
//     expect(() => {
//       getModel('invalid_provider' as any, 'invalid_model');
//     }).toThrow();
//   });

//   test('should handle API errors in stream', async () => {
//     const model = getModel('kimi', 'kimi-2.5');
//     const context: Context = {
//       systemPrompt: 'You are a helpful assistant.',
//       messages: [{ role: 'user', content: 'Test' }]
//     };

//     // 模拟 API 错误（需要在实际实现中通过 mock 来测试）
//     const s = stream(model, context);
//     let hasError = false;

//     try {
//       for await (const event of s) {
//         if (event.type === 'error') {
//           hasError = true;
//           expect(event.error).toBeTruthy();
//         }
//       }
//     } catch (error) {
//       // 也可能直接抛出异常
//       expect(error).toBeDefined();
//     }
//   });

//   test('should handle API errors in complete', async () => {
//     const model = getModel('kimi', 'kimi-2.5');
//     const context: Context = {
//       systemPrompt: 'You are a helpful assistant.',
//       messages: [{ role: 'user', content: 'Test' }]
//     };

//     try {
//       await complete(model, context);
//     } catch (error) {
//       // 应该能优雅地处理错误
//       expect(error).toBeDefined();
//     }
//   });
// });

// describe('Type safety', () => {
//   test('should enforce correct message roles', () => {
//     const validContext: Context = {
//       systemPrompt: 'Test',
//       messages: [
//         { role: 'user', content: 'Hello' },
//         { role: 'assistant', content: [{ type: 'text', text: 'Hi' }] },
//         { role: 'user', content: 'How are you?' }
//       ]
//     };

//     expect(validContext.messages.every(m => 
//       ['user', 'assistant', 'toolResult'].includes(m.role)
//     )).toBe(true);
//   });

//   test('should enforce content block types', async () => {
//     const model = getModel('kimi', 'kimi-2.5');
//     const context: Context = {
//       systemPrompt: 'Test',
//       messages: [{ role: 'user', content: 'Hello' }]
//     };

//     const response = await complete(model, context);

//     response.content.forEach(block => {
//       expect(['text', 'toolCall', 'image']).toContain(block.type);
//     });
//   });
// });

// describe('Cost tracking', () => {
//   test('should track token usage and cost', async () => {
//     const model = getModel('kimi', 'kimi-2.5');
//     const context: Context = {
//       systemPrompt: 'You are a helpful assistant.',
//       messages: [{ role: 'user', content: 'Hello' }]
//     };

//     const response = await complete(model, context);

//     expect(response.usage.input).toBeGreaterThan(0);
//     expect(response.usage.output).toBeGreaterThan(0);
//     expect(response.usage.cost.input).toBeGreaterThanOrEqual(0);
//     expect(response.usage.cost.output).toBeGreaterThanOrEqual(0);
//     expect(response.usage.cost.total).toBe(
//       response.usage.cost.input + response.usage.cost.output
//     );
//   });

//   test('should accumulate costs across multiple calls', async () => {
//     const model = getModel('kimi', 'kimi-2.5');
//     const context: Context = {
//       systemPrompt: 'You are a helpful assistant.',
//       messages: [{ role: 'user', content: 'Hello' }]
//     };

//     const firstResponse = await complete(model, context);
//     context.messages.push(firstResponse);
//     context.messages.push({ role: 'user', content: 'Tell me more' });

//     const secondResponse = await complete(model, context);

//     const totalCost = firstResponse.usage.cost.total + secondResponse.usage.cost.total;
//     expect(totalCost).toBeGreaterThan(0);
//   });
// });
