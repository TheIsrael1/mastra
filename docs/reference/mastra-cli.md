# The Mastra CLI

The Mastra CLI has the following commands:

`mastra init`

This initializes your project, creating a number of different files, including `mastra.config.ts`, `mastra.docker-compose.yaml`, and adding a `.env` file for storing your environment variables.

`mastra provision`

This prompts you for your Postgres and Inngest connection strings, and spins up a Docker container with the resources you don't have.

`mastra migrate`

This migrates your Postgres database to add [Mastra's schema](./db-storage.md) to it so it can store synced records. 

`mastra admin`

This spins up the Mastra admin console, which you can use to install integrations, manage synced records, and trigger workflows.