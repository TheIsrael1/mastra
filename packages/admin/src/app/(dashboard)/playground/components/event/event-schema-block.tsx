'use client';

import { RefinedIntegrationEvent } from '@kpl/core';
import { useEffect } from 'react';

import EventDynamicForm from '@/domains/playground/components/event-dynamic-form';
import { useEventPlaygroundContext } from '@/domains/playground/providers/event-playground-provider';

type RefinedIntegrationEventWithLogo = RefinedIntegrationEvent & {
  logoUrl: string;
};

function EventSchemaBlock({ name }: { name: string }) {
  const { frameworkEvents, setSelectedEvent } = useEventPlaygroundContext();

  const frameworkEvent = frameworkEvents.find(event => event.key === name) as RefinedIntegrationEventWithLogo;

  useEffect(() => {
    setSelectedEvent(frameworkEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworkEvent]);

  return (
    <div className="border-[0.5px] rounded-[0.375rem] bg-kpl-bg-2 border-kpl-border-1 overflow-hidden">
      <EventDynamicForm icon={frameworkEvent.logoUrl} showChangeButton={false} headerClassname="p-4 bg-kpl-bg-13" />
    </div>
  );
}

export { EventSchemaBlock };