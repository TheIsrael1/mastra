'use client';

import { useEffect, useState } from 'react';

import { CodeBlockDemo } from '@/components/code-block';
import { CopyButton } from '@/components/ui/copy-button';

import parserTypeScript from 'prettier/parser-typescript';
import prettier from 'prettier/standalone';

import { useEventPlaygroundContext } from '../../context/event-playground-context';

function EventCodeBlock() {
  const { selectedEvent, payload, mastraConnectionId } = useEventPlaygroundContext();
  const [snippet, setSnippet] = useState<string>('');

  useEffect(() => {
    if (!selectedEvent) {
      return;
    }

    const stringifiedPayload = JSON.stringify(payload, null, 2);
    const connectionIdPart = mastraConnectionId ? `connectionId: "${mastraConnectionId}",` : '// add a connectionId';

    const snippet = `
import frameworkInstance from 'path-to-framework-instance';

frameworkInstance.triggerSystemEvent({
  name: '${selectedEvent?.integrationName}',
  data: {
  trigger: '${selectedEvent?.key}',
    payload: {
      ${stringifiedPayload.substring(1, stringifiedPayload.length - 1)}
        },
      },
    user: {
          ${connectionIdPart}
        },
      });
`;

    try {
      const formatted = prettier.format(snippet, {
        parser: 'typescript',
        plugins: [parserTypeScript],
        semi: true,
        singleQuote: true,
      });
      setSnippet(formatted);
    } catch (error) {
      console.error('Prettier formatting error:', error);
    }
  }, [selectedEvent, payload, mastraConnectionId]);

  return selectedEvent ? (
    <section className="group pb-4 max-h-[27rem] overflow-scroll">
      <CopyButton
        snippet={snippet}
        classname="absolute z-40 top-4 right-4 w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
      />
      <CodeBlockDemo code={snippet} language="ts" filename="index.ts" />
    </section>
  ) : (
    <></>
  );
}

export default EventCodeBlock;
