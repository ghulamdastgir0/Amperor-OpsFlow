import { StateGraph, MessagesAnnotation, START } from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import type { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { StructuredToolInterface } from '@langchain/core/tools';

// Standard LangGraph tool-calling loop: the model decides whether to call a
// tool; if it does, ToolNode executes it and control returns to the model
// with the tool result in context; if it doesn't, the graph ends and the
// model's message is the final reply.
export function buildAssistantGraph(
  model: ChatGoogleGenerativeAI,
  tools: StructuredToolInterface[],
) {
  const modelWithTools = model.bindTools(tools);

  const graph = new StateGraph(MessagesAnnotation)
    .addNode('agent', async (state) => {
      const response = await modelWithTools.invoke(state.messages);
      return { messages: [response] };
    })
    .addNode('tools', new ToolNode(tools))
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', toolsCondition)
    .addEdge('tools', 'agent');

  return graph.compile();
}
