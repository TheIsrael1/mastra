import { isEmpty, omit } from 'lodash';
import { z } from 'zod';

import {
  ActionVariables,
  Blueprint,
  WorkflowAction,
  WorkflowCondition,
  WorkflowConditionGroup,
  WorkflowTrigger,
} from './types';
import {
  constructWorkflowContextBluePrint,
  filterChecks,
  getOutputSchemaServer,
  getSchemaServer,
} from './utils';
import { FilterOperator } from './conditions/types';
import { IntegrationApi, IntegrationContext, IntegrationEvent } from '../types';

export function evaluateCondition({
  c,
  dataCtx,
  schema,
  triggerId,
}: {
  c: WorkflowConditionGroup;
  dataCtx: any;
  schema: z.ZodSchema<unknown>;
  triggerId?: string;
}) {
  let andBranchResult = true;
  let baseResult = true;
  let orBranchResult = true;

  if (c?.field) {
    const targetSchema = resolveSchemaPath({
      currentPath: '',
      schema,
      targetPath: c.field,
      finalMap: {},
    });

    baseResult =
      resolveCondition({
        c: omit(c, 'and', 'or'),
        dataCtx,
        schema: targetSchema as z.ZodSchema<unknown>,
        triggerId: c.blockId || triggerId,
      }) === true;
  }

  if (c.and?.length) {
    andBranchResult = c.and
      .map((andCond) => {
        if (andCond.field) {
          const targetSchema = resolveSchemaPath({
            currentPath: '',
            schema,
            targetPath: andCond.field,
            finalMap: {},
          });

          return resolveCondition({
            c: andCond as WorkflowConditionGroup,
            dataCtx,
            schema: targetSchema as z.ZodSchema<unknown>,
            triggerId: andCond.blockId || triggerId,
          });
        }
      })
      .every(Boolean);
  }

  if (c.or?.length) {
    orBranchResult = c.or
      .map((orCond) => {
        if (orCond.field) {
          const targetSchema = resolveSchemaPath({
            currentPath: '',
            schema,
            targetPath: orCond.field,
            finalMap: {},
          });

          return resolveCondition({
            c: orCond as WorkflowConditionGroup,
            dataCtx,
            schema: targetSchema as z.ZodSchema<unknown>,
            triggerId: orCond.blockId || triggerId,
          });
        }
      })
      .some(Boolean);
  }

  return baseResult && andBranchResult && orBranchResult;
}

export function resolveSchemaPath({
  currentPath,
  schema,
  targetPath,
  finalMap,
}: {
  currentPath: string;
  schema: any;
  targetPath: string;
  finalMap: Record<string, any>;
}): z.ZodSchema<unknown> | undefined {
  finalMap[currentPath] = schema;
  // bail out if the target path is found
  if (finalMap[targetPath]) {
    return finalMap[targetPath];
  }

  for (const [field, value] of Object.entries(schema.shape)) {
    if (value instanceof z.ZodObject) {
      const nestedPathToSchemaMap = resolveSchemaPath({
        currentPath: currentPath ? currentPath.concat('.', field) : field,
        schema: value,
        targetPath,
        finalMap,
      });

      if (nestedPathToSchemaMap) {
        // bail out if the target path is found
        return nestedPathToSchemaMap;
      }
    } else {
      finalMap[currentPath ? currentPath.concat('.', field) : field] = value;

      // bail out if the target path is found
      if (finalMap[targetPath]) {
        return finalMap[targetPath];
      }
    }
  }

  return finalMap[targetPath];
}

export function replacePayloadVariables({
  value,
  stringContainingVariables,
  variable,
}: {
  value: string;
  stringContainingVariables: string | string[];
  variable: string;
}) {
  return Array.isArray(stringContainingVariables)
    ? stringContainingVariables.map((v) => v.replace(`{{${variable}}}`, value))
    : stringContainingVariables.replace(`{{${variable}}}`, value);
}

export function resolveCondition({
  c,
  dataCtx,
  schema,
  triggerId,
}: {
  c: WorkflowConditionGroup;
  dataCtx: any;
  triggerId?: string;
  schema: z.ZodSchema<unknown>;
}) {
  const relevantBlock = dataCtx[c?.blockId || triggerId || ''];

  if (c.isDefault) {
    return true;
  }

  if (!relevantBlock) {
    // treat as invalid filter, and move onto other filters
    // we return `true` so that it doesn't invalidate other filters in the same group
    return true;
  }

  const blockValue = resolvePath({
    path: c.field || '',
    replacementDataPayload: relevantBlock,
  });

  const operator = c.operator as FilterOperator;

  if (schema instanceof z.ZodString) {
    return filterChecks.stringCheck({
      filterField: blockValue,
      operator,
      comparator: c.value as string,
    });
  } else if (schema instanceof z.ZodNumber) {
    return filterChecks.numberCheck({
      filterField: blockValue,
      operator,
      comparator: c.value as number,
    });
  } else if (schema instanceof z.ZodBoolean) {
    return filterChecks.booleanCheck({
      filterField: blockValue,
      operator,
      comparator: c.value as boolean,
    });
  } else if (schema instanceof z.ZodDate) {
    return filterChecks.dateCheck({
      filterField: blockValue,
      operator,
      comparator: c.value as string,
    });
  } else if (schema instanceof z.ZodOptional) {
    const optionalSchema = schema._def.innerType;
    return resolveCondition({
      c,
      dataCtx,
      schema: optionalSchema,
      triggerId,
    });
  }
}

export function resolvePath({
  path,
  replacementDataPayload,
}: {
  path: string;
  replacementDataPayload: any;
}) {
  const pathParts = path.split('.');
  let resolvedValue = replacementDataPayload;

  for (const part of pathParts) {
    resolvedValue = resolvedValue[part];
  }

  return resolvedValue;
}

export function resolvePayload({
  payload,
  dataContext,
  variables,
  parentKey,
}: {
  payload: any;
  dataContext: any;
  variables?: Record<string, ActionVariables | undefined>;
  parentKey?: string;
}) {
  const resolvedPayload: Record<string, any> = Object.assign({}, payload);

  for (const [key, value] of Object.entries(resolvedPayload)) {
    if (typeof value === 'object' && !Array.isArray(value)) {
      resolvedPayload[key] = resolvePayload({
        payload: value,
        dataContext,
        variables,
        parentKey: key,
      });
    }

    if (!variables) continue;

    const currentKey = parentKey ? `${parentKey}.${key}` : key;

    const variableMap = variables[currentKey];

    // variableMap = { [variable]: { refBlockId, path }, [variable]: {refBlockId, path} }
    if (!variableMap) {
      continue;
    }

    let tempValue = value;

    for (const [variable, { refBlockId, path }] of Object.entries(
      variableMap
    )) {
      const replacementDataPayload = dataContext[refBlockId]; // get the payload returned by the relevant previous action
      if (!replacementDataPayload) {
        // if the reference block to get data from does not exist, skip
        continue;
      }

      // get the value from the replacement data payload at the path specified in the variable map
      const replacementValue = resolvePath({ path, replacementDataPayload });

      tempValue = replacePayloadVariables({
        value: replacementValue,
        stringContainingVariables: tempValue as string,
        variable,
      });
    }

    resolvedPayload[key] = tempValue;
  }

  return resolvedPayload;
}

async function runActionsRecursively({
  blueprintActions,
  frameworkApis,
  frameworkEvents,
  dataContext,
  blueprintId,
  runId,
  ctx,
  blueprintActionKVMap,
}: {
  blueprintActions: WorkflowAction[];
  frameworkApis: Record<string, IntegrationApi<any>>;
  frameworkEvents: Record<string, IntegrationEvent<any>>;
  dataContext: any;
  blueprintId: string;
  runId: string;
  ctx: IntegrationContext;
  blueprintActionKVMap: ReturnType<typeof constructWorkflowContextBluePrint>;
}): Promise<boolean> {
  for (const action of blueprintActions) {
    const concreteAction = frameworkApis[action.type];

    console.log(
      '==========',
      `Running action ${action.type}`,
      { dataContext: JSON.stringify(dataContext, null, 2) },
      '======='
    );

    // check action conditions
    if (action.type === 'CONDITIONS') {
      if (!action.condition) continue;

      let hasValidBranch = false;

      for (const cond of action.condition as WorkflowCondition[]) {
        if (cond.isDefault) continue;

        console.log('==========', `Found action condition`, '=======');

        const refBlock =
          blueprintActionKVMap.actions[cond.blockId || ''] ||
          blueprintActionKVMap.trigger;

        const currentConcreteBlock =
          frameworkApis[refBlock?.type || ''] ||
          frameworkEvents[refBlock?.type || ''];

        const isAction = !!frameworkApis[refBlock?.type || ''];

        if (!currentConcreteBlock) continue;

        const actionToRun = action.subActions.find(
          (a) => a.id === cond.actionId
        );

        if (!actionToRun) continue;

        const resolvedSchema = await getOutputSchemaServer({
          block: currentConcreteBlock as any,
          payload: refBlock?.payload || {},
          blockType: isAction ? 'action' : 'trigger',
          ctx,
        });

        const shouldRunAction = evaluateCondition({
          c: cond,
          dataCtx: dataContext,
          schema: resolvedSchema as z.ZodSchema<unknown>,
        });

        console.log('==========', { shouldRunAction }, '=======');

        if (!shouldRunAction) {
          continue;
        }

        hasValidBranch = true;

        const executorResult = await runActionsRecursively({
          blueprintActions: [actionToRun],
          frameworkApis,
          frameworkEvents,
          dataContext,
          blueprintId,
          runId,
          ctx,
          blueprintActionKVMap,
        });

        if (!executorResult) {
          return false;
        }
      }

      if (!hasValidBranch) {
        console.log('======== No valid branch found for action ============');

        // run default branch if available
        const defaultCondition = (action.condition as WorkflowCondition[]).find(
          (c) => c.isDefault
        );
        const defaultAction = action.subActions.find(
          (a) => a.id === defaultCondition?.actionId
        );

        if (defaultAction) {
          console.log('========= running default action =============');
          return await runActionsRecursively({
            blueprintActions: [defaultAction],
            dataContext,
            frameworkApis,
            frameworkEvents,
            runId,
            ctx,
            blueprintId,
            blueprintActionKVMap,
          });
        } else {
          console.log('========= No default branch found =============');
          return false;
        }
      }
    }

    const actionExecutor = concreteAction?.executor;

    if (!actionExecutor) {
      console.log(`No executor found for ${action.type}`);
      continue;
    }

    const { mastraConnectionId, ...actionPayload } = action.payload || {};

    const resolvedPayload = resolvePayload({
      payload: actionPayload,
      dataContext,
      variables: action.variables,
    });

    console.log('====Resolved payload====', { resolvedPayload });

    const resolvedSchema = await getSchemaServer({
      block: concreteAction as any,
      payload: resolvedPayload,
      blockType: 'action',
      ctx,
    });
    const data = resolvedSchema.parse(resolvedPayload);

    console.log('====Parsed data====', { data });

    let executorResult: any = {};

    const _ctx = mastraConnectionId
      ? ({ ...ctx, connectionId: mastraConnectionId,  } as IntegrationContext)
      : ctx;

    try {
      executorResult = await actionExecutor({ data, ctx: _ctx });
      console.log('executed successfully');
    } catch (e) {
      console.log('===Error executing action===', { e });
      // TODO: Update workflows runs for failed actions
      return false;
    }

    dataContext[action.id] = executorResult;

    if (action.type === `CONDITIONS` || action.subActions?.length) {
      const subActions = action.subActions;

      if (subActions?.length) {
        return await runActionsRecursively({
          blueprintActions: subActions,
          frameworkApis,
          frameworkEvents,
          dataContext,
          runId,
          ctx,
          blueprintId,
          blueprintActionKVMap,
        });
      }
    }
  }
  return true;
}

export async function blueprintRunner({
  ctx,
  dataCtx,
  blueprint,
  frameworkEvents,
  frameworkApis,
}: {
  dataCtx: any;
  ctx: IntegrationContext;
  blueprint: Blueprint;
  frameworkApis: Record<string, IntegrationApi<any>>;
  frameworkEvents: Record<string, IntegrationEvent<any>>;
}) {
  console.log(`Running blueprint ${blueprint.id}`);

  try {
    // TODO: Create workflow run (pending)
  } catch (e) {
    console.error(`Error creating workflow run ${blueprint.id}`, e);
  }

  const fullCtx = { [(blueprint.trigger as WorkflowTrigger).id]: dataCtx };

  const triggerCondition = (blueprint.trigger as WorkflowTrigger).condition;

  const concreteTrigger =
    frameworkEvents[(blueprint.trigger as WorkflowTrigger).type || ''];

  const resolvedSchema = await getOutputSchemaServer({
    block: concreteTrigger as any,
    payload: (blueprint.trigger as WorkflowTrigger)?.payload || {},
    blockType: 'trigger',
    ctx,
  });

  if (!isEmpty(triggerCondition)) {
    console.log(`Found trigger condition`, { triggerCondition });

    const shouldRunWorkflow = evaluateCondition({
      c: triggerCondition as any,
      dataCtx: fullCtx,
      triggerId: (blueprint.trigger as WorkflowTrigger).id,
      schema: resolvedSchema as z.ZodSchema<unknown>,
    });

    console.log(`Should run workflow`, { shouldRunWorkflow });

    if (!shouldRunWorkflow) {
      try {
        // if (!blueprintRun) return;
        // await automationRunService.updateAutomationRun({
        //   runId: blueprintRun?.id,
        //   blueprintId: blueprint.id,
        //   status: AutomationRunStatus.FAILED,
        // });
      } catch (e) {}
      return;
    }
  }

  const blueprintActionKVMap = constructWorkflowContextBluePrint(
    blueprint as any
  );

  try {
    // await automationRunService.updateAutomationRun({
    //   runId: blueprintRun?.id || '',
    //   blueprintId: blueprint.id,
    //   status: AutomationRunStatus.RUNNING,
    // });
  } catch (e) {}

  const ranSuccessfully = await runActionsRecursively({
    blueprintActions: blueprint.actions as any,
    frameworkApis,
    ctx,
    frameworkEvents,
    dataContext: fullCtx,
    blueprintActionKVMap,
    blueprintId: blueprint.id,
    runId: '',
  });

  try {
    if (ranSuccessfully) {
      // await automationRunService.updateAutomationRun({
      //   runId: blueprintRun?.id || '',
      //   blueprintId: blueprint.id,
      //   completedAt: new Date(),
      //   status: AutomationRunStatus.COMPLETED,
      // });
    }
  } catch (e) {}
}
