import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  streamUI,
  createStreamableValue
} from 'ai/rsc'
import { openai } from '@ai-sdk/openai'

import {
  spinner,
  BotCard,
  BotMessage,
  SystemMessage,
  Stock,
  Purchase
} from '@/components/stocks'

import { z } from 'zod'
import { EventsSkeleton } from '@/components/stocks/events-skeleton'
import { Events } from '@/components/stocks/events'
import { StocksSkeleton } from '@/components/stocks/stocks-skeleton'
import { Stocks } from '@/components/stocks/stocks'
import { StockSkeleton } from '@/components/stocks/stock-skeleton'
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { Chat, Message } from '@/lib/types'
import { auth } from '@/auth'
import { mastra } from '../mastra/framework'

async function confirmPurchase(symbol: string, price: number, amount: number) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  const purchasing = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      {spinner}
      <p className="mb-2">
        Purchasing {amount} ${symbol}...
      </p>
    </div>
  )

  const systemMessage = createStreamableUI(null)

  runAsyncFnWithoutBlocking(async () => {
    await sleep(1000)

    purchasing.update(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
          Purchasing {amount} ${symbol}... working on it...
        </p>
      </div>
    )

    await sleep(1000)

    purchasing.done(
      <div>
        <p className="mb-2">
          You have successfully purchased {amount} ${symbol}. Total cost:{' '}
          {formatNumber(amount * price)}
        </p>
      </div>
    )

    systemMessage.done(
      <SystemMessage>
        You have purchased {amount} shares of {symbol} at ${price}. Total cost ={' '}
        {formatNumber(amount * price)}.
      </SystemMessage>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'system',
          content: `[User has purchased ${amount} shares of ${symbol} at ${price}. Total cost = ${
            amount * price
          }]`
        }
      ]
    })
  })

  return {
    purchasingUI: purchasing.value,
    newMessage: {
      id: nanoid(),
      display: systemMessage.value
    }
  }
}

// const agent = createAgent({
//   maxSteps: 5,
//   model: { type: 'anthropic' },
//   toolChoice: 'required',
//   systemPrompt: `\
//     You are a sports analyst bot and you can help users answer questions about NFL games.
//     You and the user can discuss teams, athletes and weekly scores.

//     If the user asks about the outcome, winner, loser, or score of a game, call \`GET_SCORES_FOR_NFL_MATCHUPS\`.

//     If you do not have the information respond with "I do not have that information".

//     As a final step call \`REPORT_ANALYSIS_FOR_NFL_QUESTIONS\` to provide the question and answer as the message.
//     `,
//   tools: {
//     //   'send_message_on_slack': {
//     //     description: slackApis.chatPostMessage.label,
//     //     parameters: z.object({
//     //       text: z.string(),
//     //       icon_emoji: z.string().nullable(),
//     //     }),
//     //     execute: async (props) => {
//     //         await slackApis.chatPostMessage.executor({
//     //           data: {
//     //             body: {
//     //               text: props.text,
//     //               channel: `C06CRL8187L`,
//     //               icon_emoji: props.icon_emoji,
//     //             }
//     //           },
//     //           ctx: { connectionId: `1234`}
//     //         })

//     //         return { message: 'Message sent. Do not retry.' }
//     //     }
//     // },
//     ...systemTools,
//   },
// resultTool: {
//   description: 'Formatted result: returns information in structured format',
//   parameters: z.object({
//     week: z.string(),
//     outcomes: z.array(z.object({
//       message: z.string(),
//       home_team: z.string().nullable(),
//       away_team: z.string().nullable(),
//       score: z.string().nullable(),
//       analysis: z.string().nullable(),
//       athlete: z.string().nullable(),
//     }))
//   }),
// },
// })

async function sendAgentMessage({ message, assistant }: { message: string, assistant: string }) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content: message
      }
    ]
  })

  console.log(message, assistant)

  const executor = await mastra.getAgent({
    agentId: assistant,
    connectionId: '1234'
  })

  console.log('executor', executor)

  if (!executor) {
    throw new Error('Could not create agent executor')
  }

  if (typeof executor === 'function') {
    const result = await executor({ prompt: message })
    console.log('executor', result)
    //console.log('executor', JSON.stringify(result, null, 2))
    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'assistant',
          content: result?.text as string
        }
      ]
    })

    return {
      id: nanoid(),
      display: result?.text
    }
  } else {
    const thread = await executor.initializeThread([{ role: 'user', content: message }])

    const run = await executor.watchRun({ threadId: thread.id })

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'assistant',
          content: run?.content?.[0]?.text?.value
        }
      ]
    })

    return {
      id: nanoid(),
      display: run?.content?.[0]?.text?.value
    }
  }
}

// async function submitUserMessage(content: string) {
//   'use server'

//   const aiState = getMutableAIState<typeof AI>()

//   aiState.update({
//     ...aiState.get(),
//     messages: [
//       ...aiState.get().messages,
//       {
//         id: nanoid(),
//         role: 'user',
//         content
//       }
//     ]
//   })

//   let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
//   let textNode: undefined | React.ReactNode

//   const result = await streamUI({
//     model: openai('gpt-3.5-turbo'),
//     initial: <SpinnerMessage />,
//     system: `\
//     You are a stock trading conversation bot and you can help users buy stocks, step by step.
//     You and the user can discuss stock prices and the user can adjust the amount of stocks they want to buy, or place an order, in the UI.

//     Messages inside [] means that it's a UI element or a user event. For example:
//     - "[Price of AAPL = 100]" means that an interface of the stock price of AAPL is shown to the user.
//     - "[User has changed the amount of AAPL to 10]" means that the user has changed the amount of AAPL to 10 in the UI.

//     If the user requests purchasing a stock, call \`show_stock_purchase_ui\` to show the purchase UI.
//     If the user just wants the price, call \`show_stock_price\` to show the price.
//     If you want to show trending stocks, call \`list_stocks\`.
//     If you want to show events, call \`get_events\`.
//     If the user wants to sell stock, or complete another impossible task, respond that you are a demo and cannot do that.

//     Besides that, you can also chat with users and do some calculations if needed.`,
//     messages: [
//       ...aiState.get().messages.map((message: any) => ({
//         role: message.role,
//         content: message.content,
//         name: message.name
//       }))
//     ],
//     text: ({ content, done, delta }) => {
//       if (!textStream) {
//         textStream = createStreamableValue('')
//         textNode = <BotMessage content={textStream.value} />
//       }

//       if (done) {
//         textStream.done()
//         aiState.done({
//           ...aiState.get(),
//           messages: [
//             ...aiState.get().messages,
//             {
//               id: nanoid(),
//               role: 'assistant',
//               content
//             }
//           ]
//         })
//       } else {
//         textStream.update(delta)
//       }

//       return textNode
//     },
//     tools: {
//       listStocks: {
//         description: 'List three imaginary stocks that are trending.',
//         parameters: z.object({
//           stocks: z.array(
//             z.object({
//               symbol: z.string().describe('The symbol of the stock'),
//               price: z.number().describe('The price of the stock'),
//               delta: z.number().describe('The change in price of the stock')
//             })
//           )
//         }),
//         generate: async function* ({ stocks }) {
//           yield (
//             <BotCard>
//               <StocksSkeleton />
//             </BotCard>
//           )

//           await sleep(1000)

//           const toolCallId = nanoid()

//           aiState.done({
//             ...aiState.get(),
//             messages: [
//               ...aiState.get().messages,
//               {
//                 id: nanoid(),
//                 role: 'assistant',
//                 content: [
//                   {
//                     type: 'tool-call',
//                     toolName: 'listStocks',
//                     toolCallId,
//                     args: { stocks }
//                   }
//                 ]
//               },
//               {
//                 id: nanoid(),
//                 role: 'tool',
//                 content: [
//                   {
//                     type: 'tool-result',
//                     toolName: 'listStocks',
//                     toolCallId,
//                     result: stocks
//                   }
//                 ]
//               }
//             ]
//           })

//           return (
//             <BotCard>
//               <Stocks props={stocks} />
//             </BotCard>
//           )
//         }
//       },
//       showStockPrice: {
//         description:
//           'Get the current stock price of a given stock or currency. Use this to show the price to the user.',
//         parameters: z.object({
//           symbol: z
//             .string()
//             .describe(
//               'The name or symbol of the stock or currency. e.g. DOGE/AAPL/USD.'
//             ),
//           price: z.number().describe('The price of the stock.'),
//           delta: z.number().describe('The change in price of the stock')
//         }),
//         generate: async function* ({ symbol, price, delta }) {
//           yield (
//             <BotCard>
//               <StockSkeleton />
//             </BotCard>
//           )

//           await sleep(1000)

//           const toolCallId = nanoid()

//           aiState.done({
//             ...aiState.get(),
//             messages: [
//               ...aiState.get().messages,
//               {
//                 id: nanoid(),
//                 role: 'assistant',
//                 content: [
//                   {
//                     type: 'tool-call',
//                     toolName: 'showStockPrice',
//                     toolCallId,
//                     args: { symbol, price, delta }
//                   }
//                 ]
//               },
//               {
//                 id: nanoid(),
//                 role: 'tool',
//                 content: [
//                   {
//                     type: 'tool-result',
//                     toolName: 'showStockPrice',
//                     toolCallId,
//                     result: { symbol, price, delta }
//                   }
//                 ]
//               }
//             ]
//           })

//           return (
//             <BotCard>
//               <Stock props={{ symbol, price, delta }} />
//             </BotCard>
//           )
//         }
//       },
//       showStockPurchase: {
//         description:
//           'Show price and the UI to purchase a stock or currency. Use this if the user wants to purchase a stock or currency.',
//         parameters: z.object({
//           symbol: z
//             .string()
//             .describe(
//               'The name or symbol of the stock or currency. e.g. DOGE/AAPL/USD.'
//             ),
//           price: z.number().describe('The price of the stock.'),
//           numberOfShares: z
//             .number()
//             .optional()
//             .describe(
//               'The **number of shares** for a stock or currency to purchase. Can be optional if the user did not specify it.'
//             )
//         }),
//         generate: async function* ({ symbol, price, numberOfShares = 100 }) {
//           const toolCallId = nanoid()

//           if (numberOfShares <= 0 || numberOfShares > 1000) {
//             aiState.done({
//               ...aiState.get(),
//               messages: [
//                 ...aiState.get().messages,
//                 {
//                   id: nanoid(),
//                   role: 'assistant',
//                   content: [
//                     {
//                       type: 'tool-call',
//                       toolName: 'showStockPurchase',
//                       toolCallId,
//                       args: { symbol, price, numberOfShares }
//                     }
//                   ]
//                 },
//                 {
//                   id: nanoid(),
//                   role: 'tool',
//                   content: [
//                     {
//                       type: 'tool-result',
//                       toolName: 'showStockPurchase',
//                       toolCallId,
//                       result: {
//                         symbol,
//                         price,
//                         numberOfShares,
//                         status: 'expired'
//                       }
//                     }
//                   ]
//                 },
//                 {
//                   id: nanoid(),
//                   role: 'system',
//                   content: `[User has selected an invalid amount]`
//                 }
//               ]
//             })

//             return <BotMessage content={'Invalid amount'} />
//           } else {
//             aiState.done({
//               ...aiState.get(),
//               messages: [
//                 ...aiState.get().messages,
//                 {
//                   id: nanoid(),
//                   role: 'assistant',
//                   content: [
//                     {
//                       type: 'tool-call',
//                       toolName: 'showStockPurchase',
//                       toolCallId,
//                       args: { symbol, price, numberOfShares }
//                     }
//                   ]
//                 },
//                 {
//                   id: nanoid(),
//                   role: 'tool',
//                   content: [
//                     {
//                       type: 'tool-result',
//                       toolName: 'showStockPurchase',
//                       toolCallId,
//                       result: {
//                         symbol,
//                         price,
//                         numberOfShares
//                       }
//                     }
//                   ]
//                 }
//               ]
//             })

//             return (
//               <BotCard>
//                 <Purchase
//                   props={{
//                     numberOfShares,
//                     symbol,
//                     price: +price,
//                     status: 'requires_action'
//                   }}
//                 />
//               </BotCard>
//             )
//           }
//         }
//       },
//       getEvents: {
//         description:
//           'List funny imaginary events between user highlighted dates that describe stock activity.',
//         parameters: z.object({
//           events: z.array(
//             z.object({
//               date: z
//                 .string()
//                 .describe('The date of the event, in ISO-8601 format'),
//               headline: z.string().describe('The headline of the event'),
//               description: z.string().describe('The description of the event')
//             })
//           )
//         }),
//         generate: async function* ({ events }) {
//           yield (
//             <BotCard>
//               <EventsSkeleton />
//             </BotCard>
//           )

//           await sleep(1000)

//           const toolCallId = nanoid()

//           aiState.done({
//             ...aiState.get(),
//             messages: [
//               ...aiState.get().messages,
//               {
//                 id: nanoid(),
//                 role: 'assistant',
//                 content: [
//                   {
//                     type: 'tool-call',
//                     toolName: 'getEvents',
//                     toolCallId,
//                     args: { events }
//                   }
//                 ]
//               },
//               {
//                 id: nanoid(),
//                 role: 'tool',
//                 content: [
//                   {
//                     type: 'tool-result',
//                     toolName: 'getEvents',
//                     toolCallId,
//                     result: events
//                   }
//                 ]
//               }
//             ]
//           })

//           return (
//             <BotCard>
//               <Events props={events} />
//             </BotCard>
//           )
//         }
//       }
//     }
//   })

//   return {
//     id: nanoid(),
//     display: result.value
//   }
// }

export type AIState = {
  chatId: string
  messages: Message[]
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: {
    sendAgentMessage,
    confirmPurchase
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState() as Chat

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  },
  onSetAIState: async ({ state, done }) => {
    'use server'

    if (!done) return

    const session = await auth()
    if (!session || !session.user) return

    const { chatId, messages } = state

    const createdAt = new Date()
    const userId = session.user.id as string
    const path = `/chat/${chatId}`

    const firstMessageContent = messages[0].content as string
    const title = firstMessageContent.substring(0, 100)

    const chat: Chat = {
      id: chatId,
      title,
      userId,
      createdAt,
      messages,
      path
    }

    await saveChat(chat)
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'tool' ? (
          message.content.map(tool => {
            return tool.toolName === 'listStocks' ? (
              <BotCard>
                {/* TODO: Infer types based on the tool result*/}
                {/* @ts-expect-error */}
                <Stocks props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPrice' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Stock props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPurchase' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Purchase props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'getEvents' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Events props={tool.result} />
              </BotCard>
            ) : null
          })
        ) : message.role === 'user' ? (
          <UserMessage>{message.content as string}</UserMessage>
        ) : message.role === 'assistant' &&
          typeof message.content === 'string' ? (
          <BotMessage content={message.content} />
        ) : null
    }))
}
