'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectDropDown from '@/components/ui/select-dropdown';

import { cn } from '@/lib/utils';

import Icon from '@/app/components/icon';
import { useIntegrationEventsAndEntities } from '@/domains/integrations/hooks/use-integration';
import { IntegrationSyncEvent } from '@/domains/integrations/types';

import { VectorEntityData, useVectorFormContext } from '../context/vector-form-context';

export const VectorProviderFormEntity = ({
  integration,
  entityIndex,
  currentEntityData,
}: {
  integration: string;
  entityIndex: number;
  currentEntityData: VectorEntityData;
}) => {
  const { setSearchedEntity, events, setIntegration, isLoading } = useIntegrationEventsAndEntities({
    page: 1,
    integration: integration,
    pageSize: 40,
    searchedEntity: currentEntityData?.name,
  });

  const [openEntities, setOpenEntities] = useState(false);
  const [openFields, setOpenFields] = useState(false);

  const { entities, setEntities } = useVectorFormContext();

  const entityEvent = events?.find(val => val.entityType === currentEntityData.name)!;

  const { data: currentEntityDataArray } = entities?.find(en => en.integration === integration) || {};

  const allowedFieldTypes = ['SINGLE_LINE_TEXT', 'SINGLE_SELECT', 'NUMBER', 'FLOAT', 'LONG_TEXT'];

  const updateEntityEvent = (entt: IntegrationSyncEvent & { selectedFields?: string[] }) => {
    const newEntities = [...(entities || [])]?.map(ent => {
      if (ent.integration === integration) {
        const newData = [...ent.data]?.map((d, index) => {
          if (index === entityIndex) {
            const { selectedFields, entityType } = entt;
            return {
              ...d,
              fields: selectedFields || d.fields,
              name: entityType,
              index: [integration, entityType, ...(selectedFields || d.fields)]?.join('_')?.toLowerCase(),
              syncEvent: entt.syncEvent,
            };
          }
          return d;
        });

        return {
          ...ent,
          data: newData,
        };
      }

      return ent;
    });
    setEntities(newEntities);
  };

  const removeEntityEvent = (enttType: string) => {
    const newEntities = [...(entities || [])]?.map(ent => {
      if (ent.integration === integration) {
        console.log({ ent });
        const newData = [...ent.data]?.filter(d => d.name !== enttType);
        console.log({ newData });

        return {
          ...ent,
          data: newData,
        };
      }

      return ent;
    });
    setEntities(newEntities);
  };

  const addNewEntityEvent = () => {
    const newEntities = [...(entities || [])]?.map(ent => {
      if (ent.integration === integration) {
        const newData = [...ent.data, { index: '', name: '', fields: [], syncEvent: '' }];

        return {
          ...ent,
          data: newData,
        };
      }

      return ent;
    });
    setEntities(newEntities);
  };

  useEffect(() => {
    setIntegration(integration);
  }, [integration]);

  return (
    <div className="space-y-2">
      <div className="border border-mastra-border-1 rounded p-3 pb-3.5 bg-mastra-bg-3 space-y-2 flex-1">
        <div className="space-y-1 pr-4">
          <div className="flex items-center justify-between">
            <Label className="text-gray-400 text-sm font-normal">Entity type</Label>

            {currentEntityDataArray?.length === 1 ? null : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: currentEntityData?.name ? 1 : 0.3, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  type: 'spring',
                  bounce: 0,
                  duration: 0.5,
                }}
              >
                <IconButton
                  icon="trash"
                  onClick={() => {
                    removeEntityEvent(currentEntityData?.name!);
                  }}
                  className="cursor-pointer p-0 text-mastra-el-1 flex items-center rounded"
                  title={`Remove entity item from ${integration}`}
                  size="xs"
                />
              </motion.div>
            )}
          </div>
          <SelectDropDown
            idKey="entityType"
            nameKey="entityType"
            open={openEntities}
            onOpenChange={open => {
              setOpenEntities(open);
            }}
            data={events?.map(ev => ({
              ...ev,
              isDisabled: currentEntityDataArray?.some(d => d.name === ev.entityType),
            }))}
            selectedValues={entityEvent ? [entityEvent] : []}
            setSelectedValues={values => {
              const ent = values?.[0];
              updateEntityEvent({ ...ent, selectedFields: [] });
              setOpenFields(true);
            }}
            placeholder="Search for entity"
            isSingleSelect
            withCheckbox={false}
            asRadio
            onSearch={setSearchedEntity}
            isSearching={isLoading}
          >
            <Button
              type="button"
              variant={'ghost'}
              className=" w-full py-5 mt-1 text-gray-300 flex items-center justify-start cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
            >
              {currentEntityData?.name ? currentEntityData.name : 'Search for entity'}

              <Icon name="down-caret" className="ml-auto" />
            </Button>
          </SelectDropDown>
        </div>
        {currentEntityData?.name ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.5,
            }}
            className="space-y-2 px-4"
          >
            <div className="space-y-1">
              <Label className="text-gray-400 text-xs font-normal">Fields</Label>
              <SelectDropDown
                idKey="value"
                nameKey="label"
                open={openFields}
                onOpenChange={setOpenFields}
                data={
                  entityEvent?.fields
                    ?.filter(({ type }) => allowedFieldTypes?.includes(type))
                    ?.map(field => ({ label: field.displayName || field.name, value: field.name })) || []
                }
                selectedValues={currentEntityData.fields?.map(item => ({ label: item, value: item }))}
                setSelectedValues={values => {
                  updateEntityEvent({ ...entityEvent, selectedFields: values?.map(({ value }) => value) });
                }}
                placeholder="Fields to sync"
                withCheckbox={true}
              >
                <Button
                  type="button"
                  variant={'ghost'}
                  className=" w-full py-5 mt-1 text-gray-300 flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
                >
                  {currentEntityData.fields.length ? (
                    <>
                      <span className="flex items-center flex-wrap gap-1">
                        {currentEntityData.fields.slice(0, 5)?.map(field => (
                          <span className="text-xs rounded-full text-inherit px-2 py-1 bg-mastra-bg-9" key={field}>
                            {field}
                          </span>
                        ))}
                        <span
                          className={cn(
                            currentEntityData.fields.length > 5
                              ? 'text-xs italic text-inherit rounded-full px-2 py-1 bg-mastra-bg-9'
                              : '',
                          )}
                        >
                          {currentEntityData.fields.length > 5 ? `+ ${currentEntityData.fields.length - 5}` : ''}
                        </span>
                      </span>
                    </>
                  ) : (
                    'Select Fields'
                  )}

                  <Icon name="down-caret" className="ml-auto" />
                </Button>
              </SelectDropDown>
            </div>

            <div className="space-y-1">
              <Label className="text-gray-400 text-xs font-normal">Index name</Label>
              <Input
                type={'text'}
                className="placeholder:text-xs  py-5 bg-white/5 overflow-ellipsis"
                placeholder={'Enter index name'}
                autoComplete="false"
                autoCorrect="false"
                value={currentEntityData.index}
                disabled
              />
            </div>
          </motion.div>
        ) : null}
      </div>

      {currentEntityData?.name && entityIndex === (currentEntityDataArray?.length as number) - 1 ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{
            type: 'spring',
            bounce: 0,
            duration: 0.5,
          }}
        >
          <Button
            variant="ghost"
            type="button"
            size="sm"
            className="flex cursor-pointer items-center text-mastra-el-accent text-sm gap-2"
            onClick={() => {
              addNewEntityEvent();
            }}
          >
            <Icon name="plus-icon" />
            Add new entity
          </Button>
        </motion.div>
      ) : null}
    </div>
  );
};