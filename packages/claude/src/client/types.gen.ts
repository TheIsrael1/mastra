// This file is auto-generated by @hey-api/openapi-ts

export type Error = {
    type: string;
    message: string;
};

export type ErrorResponse = {
    error: Error;
};

export type CreateCompletionRequest = {
    /**
     * The model that will complete your prompt.
     * As we improve Claude, we develop new versions of it that you can query.
     * This parameter controls which version of Claude answers your request.
     * Right now we are offering two model families: Claude, and Claude Instant.
     * You can use them by setting model to "claude-2" or "claude-instant-1", respectively.
     * See models for additional details.
     *
     */
    model: (string | 'claude-2' | 'claude-2.0' | 'claude-instant-1' | 'claude-instant-1.1');
    /**
     * The prompt that you want Claude to complete.
     *
     * For proper response generation you will need to format your prompt as follows:
     * \n\nHuman: ${userQuestion}\n\nAssistant:
     * See our comments on prompts for more context.
     *
     */
    prompt: ((string | Array<(string)> | Array<(number)> | Array<Array<(number)>>) | null);
    /**
     * The maximum number of tokens to generate before stopping.
     *
     * Note that our models may stop before reaching this maximum. This parameter only specifies the absolute maximum number of tokens to generate.
     *
     */
    max_tokens_to_sample: (number) | null;
    /**
     * Amount of randomness injected into the response.
     *
     * Defaults to 1. Ranges from 0 to 1. Use temp closer to 0 for analytical / multiple choice, and closer to 1 for creative and generative tasks.
     *
     */
    temperature?: (number) | null;
    /**
     * Use nucleus sampling.
     *
     * In nucleus sampling, we compute the cumulative distribution over all the options
     * for each subsequent token in decreasing probability order and cut it off once
     * it reaches a particular probability specified by top_p. You should either alter temperature or top_p, but not both.
     *
     */
    top_p?: (number) | null;
    /**
     * Only sample from the top K options for each subsequent token.
     *
     * Used to remove "long tail" low probability responses. Learn more technical details here.
     *
     */
    top_k?: (number) | null;
    /**
     * Whether to incrementally stream the response using server-sent events.
     * See this guide to SSE events for details.type: boolean
     *
     */
    stream?: unknown;
    /**
     * Sequences that will cause the model to stop generating completion text.
     * Our models stop on "\n\nHuman:", and may include additional built-in stop sequences in the future. By providing the stop_sequences parameter, you may include additional strings that will cause the model to stop generating.
     *
     */
    stop_sequences?: ((string) | null | Array<(string)>);
    /**
     * An object describing metadata about the request.
     *
     */
    metadata?: {
        /**
         * An external identifier for the user who is associated with the request.
         *
         * This should be a uuid, hash value, or other opaque identifier. Anthropic may use this id to help detect abuse.
         * Do not include any identifying information such as name, email address, or phone number.
         *
         */
        user_id?: string;
    };
};

export type CreateCompletionResponse = {
    /**
     * The reason that we stopped sampling.
     *
     * This may be one the following values:
     *
     * "stop_sequence": we reached a stop sequence — either provided by you via the stop_sequences parameter, or a stop sequence built into the model
     * "max_tokens": we exceeded max_tokens_to_sample or the model's maximum
     *
     */
    stop_reason: 'stop_sequence' | 'max_tokens';
    /**
     * The model that performed the completion.
     *
     */
    model: string;
    /**
     * The resulting completion up to and excluding the stop sequences.
     *
     */
    completion: string;
};

/**
 * The reason that we stopped sampling.
 *
 * This may be one the following values:
 *
 * "stop_sequence": we reached a stop sequence — either provided by you via the stop_sequences parameter, or a stop sequence built into the model
 * "max_tokens": we exceeded max_tokens_to_sample or the model's maximum
 *
 */
export type stop_reason = 'stop_sequence' | 'max_tokens';

export type CreateCompletionStreamResponse = {
    /**
     * The reason that we stopped sampling.
     *
     * This may be one the following values:
     *
     * "stop_sequence": we reached a stop sequence — either provided by you via the stop_sequences parameter, or a stop sequence built into the model
     * "max_tokens": we exceeded max_tokens_to_sample or the model's maximum
     *
     */
    stop_reason: 'stop_sequence' | 'max_tokens';
    /**
     * The model that performed the completion.
     *
     */
    model: string;
    /**
     * The resulting completion up to and excluding the stop sequences.
     *
     */
    completion: string;
    choices?: Array<{
        delta?: CompletionStreamResponseDelta;
    }>;
};

export type CompletionStreamResponseDelta = {
    /**
     * The contents of the chunk message.
     */
    completion?: (string) | null;
    /**
     * The reason that we stopped sampling.
     *
     * This may be one the following values:
     *
     * "stop_sequence": we reached a stop sequence — either provided by you via the stop_sequences parameter, or a stop sequence built into the model
     * "max_tokens": we exceeded max_tokens_to_sample or the model's maximum
     *
     */
    stop_reason?: ('stop_sequence' | 'max_tokens') | null;
    /**
     * The model that performed the completion.
     *
     */
    model?: string;
};

export type CompleteData = {
    body: CreateCompletionRequest;
};

export type CompleteResponse = (CreateCompletionResponse);

export type CompleteError = unknown;