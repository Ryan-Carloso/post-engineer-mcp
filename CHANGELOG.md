# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

- `PostEngineerClient.createSchedule` now requires `scheduledAt` in `CreateScheduleInput` (previously optional). The MCP `schedule_video` tool and the server always required it — an omitted value could never succeed, only fail server-side with an opaque error. Direct callers that omitted it now get a clear client-side error (`scheduledAt is required …`) instead.
- `PostEngineerClient.generateVideoJob` is now strict about invalid combinations: passing `voiceId` together with `personaId` throws (`voiceId` was previously silently dropped from the payload); faceless calls (no `personaId`) require a non-empty `videoSubject`; blank `personaId`/`audioUrl`/`voiceId` values are hard errors instead of being silently normalized to `undefined`.
- Client-side input validation failures now throw the exported `ValidationError` (extends `Error`, `name === 'ValidationError'`) instead of a plain `Error`, so callers can distinguish bad input from network/HTTP failures (which remain plain `Error`). `instanceof Error` checks keep working.
