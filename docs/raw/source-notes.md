# Source provenance and limitations

## Source and coverage

Source: [Project Plan](https://panoramic-burn-f2a.notion.site/Project-Plan-3f83bed3ae0480d39dd5e3fcfb66bac8), page ID `3f83bed3-ae04-80d3-9dd5-e3fcfb66bac8`.

The page describes itself as the “Project control centre for the Partners On Purpose eLearning build.” Its content consists of that callout, the two databases below, and an empty heading. The parent workspace was not included in the public page response.

| Published database | Records | Local representation |
| --- | ---: | --- |
| WBS Tasks | 135 | [Task index](task-index.md), nine module indexes and one page per WBS ID |
| Milestones & Release Gates | 8 | [Milestones](milestones.md), M0 through M7 |

Downloaded through the public site's `loadPageChunk` and `queryCollection` endpoints without authentication. Database queries requested up to 1,000 rows and returned `hasMore: false`. Every task and milestone page was fetched separately; every page cursor was exhausted and every referenced child block was present. Alternate database views are retained in the root JSON; their layouts are not duplicated as task lists.

The [manifest](manifest.json) records acquisition time, counts, validation and SHA-256 hashes. Raw responses are retained unchanged under `source/`. `specification.json` decodes property names, dates and relations while preserving original rich-text properties. Numeric text remains text to avoid unnecessary conversion. Formula definitions and rollup schemas are preserved; missing computed values are not fabricated.

## Conflicting release dates

| Source location | R1 employer launch | R2 card sales |
| --- | --- | --- |
| Task and milestone Release property values | 30 Oct | 27 Nov |
| Database schema Release options | 6 Nov | 4 Dec |
| M4 and M6 Target Date and Done Means | 2026-11-06 | 2026-12-04 |

The local copy preserves all three forms. M4 and M6 provide explicit target dates, but that does not authorize silently correcting the Release values. The overview reports the milestone targets and flags the discrepancy.

## References outside the readable public plan

Twenty-four distinct page relations returned an empty record map when fetched. Their content and the reason it was unavailable are unknown. They remain external links, with fetch responses retained as evidence. See the list below for IDs and referring properties.

Textual WBS predecessors absent from the 135 published tasks are `0.1.01`, `0.1.04`, `0.1.05`, `0.1.06`, `0.2.05` and `0.2.06`. Do not treat these dependencies as satisfied. The full PM/governance and RAID context cannot be reconstructed from this public page alone.

References such as “Proposal v2 p4” and “Deck s9” are retained as source citations; those documents were not attached to this public page and have not been downloaded from it.

## Existing workspace references

The pre-existing [technical specification HTML](cogniate-moodle-integration-spec.html) and [draft proposal image](draft_proposal.jpeg) remain unchanged. They were not merged into the Notion snapshot or assumed to resolve its conflicts.

## Unavailable relation records

- [0bf2541b-a1fd-447a-b068-496945c9e2e6](https://panoramic-burn-f2a.notion.site/0bf2541ba1fd447ab068496945c9e2e6): [2.1.12](tasks/2.1.12.md) (Blocked by), [2.1.18](tasks/2.1.18.md) (Blocked by), [M1](milestones.md#m1) (Linked Tasks). [Fetch response](source/pages/0bf2541b-a1fd-447a-b068-496945c9e2e6.json).

- [1090de8d-352c-4697-a00f-e2d166c88d81](https://panoramic-burn-f2a.notion.site/1090de8d352c4697a00fe2d166c88d81): [1.3.08](tasks/1.3.08.md) (RAID Items), [2.5.03](tasks/2.5.03.md) (RAID Items). [Fetch response](source/pages/1090de8d-352c-4697-a00f-e2d166c88d81.json).

- [119ec099-8c0a-4984-9364-cadb918ae5c4](https://panoramic-burn-f2a.notion.site/119ec0998c0a49849364cadb918ae5c4): [2.2.02](tasks/2.2.02.md) (RAID Items). [Fetch response](source/pages/119ec099-8c0a-4984-9364-cadb918ae5c4.json).

- [1cf2de84-1612-404f-8400-35453ae9df68](https://panoramic-burn-f2a.notion.site/1cf2de841612404f840035453ae9df68): [2.3.13](tasks/2.3.13.md) (RAID Items). [Fetch response](source/pages/1cf2de84-1612-404f-8400-35453ae9df68.json).

- [214eb230-4ab5-41e9-a4cf-f7eb74461d84](https://panoramic-burn-f2a.notion.site/214eb2304ab541e9a4cff7eb74461d84): [2.4.04](tasks/2.4.04.md) (RAID Items), [2.5.03](tasks/2.5.03.md) (RAID Items), [2.5.04](tasks/2.5.04.md) (RAID Items), [2.5.05](tasks/2.5.05.md) (RAID Items). [Fetch response](source/pages/214eb230-4ab5-41e9-a4cf-f7eb74461d84.json).

- [27977a1a-d06b-4f82-ad54-fa55d3d1aef3](https://panoramic-burn-f2a.notion.site/27977a1ad06b4f82ad54fa55d3d1aef3): [2.4.11](tasks/2.4.11.md) (Blocked by), [2.6.09](tasks/2.6.09.md) (Blocking), [2.6.10](tasks/2.6.10.md) (Blocking), [2.6.12](tasks/2.6.12.md) (Blocking), [2.6.14](tasks/2.6.14.md) (Blocked by), [M6](milestones.md#m6) (Linked Tasks). [Fetch response](source/pages/27977a1a-d06b-4f82-ad54-fa55d3d1aef3.json).

- [2b23a183-066a-440c-a4b8-bbb5a647af3a](https://panoramic-burn-f2a.notion.site/2b23a183066a440ca4b8bbb5a647af3a): [2.3.01](tasks/2.3.01.md) (RAID Items). [Fetch response](source/pages/2b23a183-066a-440c-a4b8-bbb5a647af3a.json).

- [2bfae33a-e0ab-4f5f-a451-2819bb927502](https://panoramic-burn-f2a.notion.site/2bfae33ae0ab4f5fa4512819bb927502): [2.3.01](tasks/2.3.01.md) (RAID Items). [Fetch response](source/pages/2bfae33a-e0ab-4f5f-a451-2819bb927502.json).

- [45dd7d77-8c1f-4762-8470-75ba0239712e](https://panoramic-burn-f2a.notion.site/45dd7d778c1f4762847075ba0239712e): [2.4.12](tasks/2.4.12.md) (RAID Items). [Fetch response](source/pages/45dd7d77-8c1f-4762-8470-75ba0239712e.json).

- [6e0f3cfd-049d-4af2-9e7a-ef67ba64b143](https://panoramic-burn-f2a.notion.site/6e0f3cfd049d4af29e7aef67ba64b143): [1.1.01](tasks/1.1.01.md) (Blocked by), [M0](milestones.md#m0) (Linked Tasks). [Fetch response](source/pages/6e0f3cfd-049d-4af2-9e7a-ef67ba64b143.json).

- [722b43c4-ab26-47cd-b061-fb135f578d33](https://panoramic-burn-f2a.notion.site/722b43c4ab2647cdb061fb135f578d33): [2.6.16](tasks/2.6.16.md) (Blocking), [M7](milestones.md#m7) (Linked Tasks). [Fetch response](source/pages/722b43c4-ab26-47cd-b061-fb135f578d33.json).

- [7716ef60-baaa-47aa-ab3e-c07ad22e3c86](https://panoramic-burn-f2a.notion.site/7716ef60baaa47aaab3ec07ad22e3c86): [M0](milestones.md#m0) (Linked Tasks). [Fetch response](source/pages/7716ef60-baaa-47aa-ab3e-c07ad22e3c86.json).

- [7bdce758-7a2c-4ad0-a535-1935c99c5431](https://panoramic-burn-f2a.notion.site/7bdce7587a2c4ad0a5351935c99c5431): [1.3.27](tasks/1.3.27.md) (Blocking), [2.6.13](tasks/2.6.13.md) (Blocking). [Fetch response](source/pages/7bdce758-7a2c-4ad0-a535-1935c99c5431.json).

- [80639a27-a39d-4a9b-82b9-9ad18c53b73a](https://panoramic-burn-f2a.notion.site/80639a27a39d4a9b82b99ad18c53b73a): [2.2.07](tasks/2.2.07.md) (RAID Items), [2.3.12](tasks/2.3.12.md) (RAID Items), [2.3.16](tasks/2.3.16.md) (RAID Items). [Fetch response](source/pages/80639a27-a39d-4a9b-82b9-9ad18c53b73a.json).

- [874c385b-05ff-4d82-9ba6-30bcd7b2ed4f](https://panoramic-burn-f2a.notion.site/874c385b05ff4d829ba630bcd7b2ed4f): [2.1.01](tasks/2.1.01.md) (RAID Items). [Fetch response](source/pages/874c385b-05ff-4d82-9ba6-30bcd7b2ed4f.json).

- [96e9dc00-c6ec-49c0-b1eb-a5e54953a6b5](https://panoramic-burn-f2a.notion.site/96e9dc00c6ec49c0b1eba5e54953a6b5): [1.3.01](tasks/1.3.01.md) (Blocked by), [1.3.24](tasks/1.3.24.md) (Blocked by), [1.3.25](tasks/1.3.25.md) (Blocked by), [2.1.01](tasks/2.1.01.md) (Blocked by), [2.1.02](tasks/2.1.02.md) (Blocked by), [2.3.00](tasks/2.3.00.md) (Blocked by), [2.4.01](tasks/2.4.01.md) (Blocked by), [M1](milestones.md#m1) (Linked Tasks). [Fetch response](source/pages/96e9dc00-c6ec-49c0-b1eb-a5e54953a6b5.json).

- [a7c777a5-c431-4c21-a2d0-87bf2484f714](https://panoramic-burn-f2a.notion.site/a7c777a5c4314c21a2d087bf2484f714): [2.2.06](tasks/2.2.06.md) (RAID Items), [2.4.01](tasks/2.4.01.md) (RAID Items). [Fetch response](source/pages/a7c777a5-c431-4c21-a2d0-87bf2484f714.json).

- [ac0551a6-bf43-411c-abfb-976797641ea1](https://panoramic-burn-f2a.notion.site/ac0551a6bf43411cabfb976797641ea1): [1.1.08](tasks/1.1.08.md) (RAID Items), [1.3.14](tasks/1.3.14.md) (RAID Items). [Fetch response](source/pages/ac0551a6-bf43-411c-abfb-976797641ea1.json).

- [b5542269-2353-406f-a053-961f7fcfad26](https://panoramic-burn-f2a.notion.site/b55422692353406fa053961f7fcfad26): [2.2.02](tasks/2.2.02.md) (Blocking), [2.3.01](tasks/2.3.01.md) (Blocking), [2.3.02](tasks/2.3.02.md) (Blocking), [2.4.01](tasks/2.4.01.md) (Blocking), [M1](milestones.md#m1) (Linked Tasks). [Fetch response](source/pages/b5542269-2353-406f-a053-961f7fcfad26.json).

- [c40a38e0-aab2-4caf-8204-afcd004a39e5](https://panoramic-burn-f2a.notion.site/c40a38e0aab24caf8204afcd004a39e5): [1.3.23](tasks/1.3.23.md) (Blocking), [1.3.26](tasks/1.3.26.md) (Blocked by), [2.6.04](tasks/2.6.04.md) (Blocking), [M4](milestones.md#m4) (Linked Tasks). [Fetch response](source/pages/c40a38e0-aab2-4caf-8204-afcd004a39e5.json).

- [dba4dc9b-6fae-4844-8dfa-fca34d6594b8](https://panoramic-burn-f2a.notion.site/dba4dc9b6fae48448dfafca34d6594b8): [2.6.14](tasks/2.6.14.md) (Blocking), [M7](milestones.md#m7) (Linked Tasks). [Fetch response](source/pages/dba4dc9b-6fae-4844-8dfa-fca34d6594b8.json).

- [e4b368cb-3be4-4b15-8777-251613a73519](https://panoramic-burn-f2a.notion.site/e4b368cb3be44b158777251613a73519): [2.1.22](tasks/2.1.22.md) (Blocked by), [M1](milestones.md#m1) (Linked Tasks). [Fetch response](source/pages/e4b368cb-3be4-4b15-8777-251613a73519.json).

- [e9558d5b-eb48-40e8-9d62-f344ab7e1f77](https://panoramic-burn-f2a.notion.site/e9558d5beb4840e89d62f344ab7e1f77): [1.3.17](tasks/1.3.17.md) (RAID Items), [2.5.04](tasks/2.5.04.md) (RAID Items). [Fetch response](source/pages/e9558d5b-eb48-40e8-9d62-f344ab7e1f77.json).

- [ee474fd6-5de3-4be7-933c-359e0688b532](https://panoramic-burn-f2a.notion.site/ee474fd65de34be7933c359e0688b532): [2.1.19](tasks/2.1.19.md) (RAID Items). [Fetch response](source/pages/ee474fd6-5de3-4be7-933c-359e0688b532.json).
