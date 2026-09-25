# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

- `PostEngineerClient.createSchedule` now requires `scheduledAt` in `CreateScheduleInput` (previously optional). The MCP `schedule_video` tool and the server always required it — an omitted value could never succeed, only fail server-side with an opaque error. Direct callers that omitted it now get a clear client-side error (`scheduledAt is required …`) instead.
