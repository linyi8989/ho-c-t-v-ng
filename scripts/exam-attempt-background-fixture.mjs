import fs from 'node:fs';
import { createDefaultExamContent, getExamPaperDefinition, EXAM_PAPER_DEFINITIONS } from '../src/features/exam-platform/definitions.ts';
import { createDefaultMoverReadingWritingContent } from '../src/features/mover-reading-writing/defaultContent.ts';
import { createDefaultMoverListeningContent } from '../src/features/listening-library/modules/mover/editor/moduleDefinition.ts';
const cases={};
for(const definition of EXAM_PAPER_DEFINITIONS.filter(d=>d.moduleId!=='writing')){const {moduleId,paperId}=definition;const content=createDefaultExamContent(definition);cases[moduleId+'-'+paperId]={kind:'generic',moduleId,paperId,playable:{id:'qa-'+moduleId+'-'+paperId,versionId:'qa-version',title:definition.displayName,description:definition.level,level:definition.level,timeLimitMinutes:0,content}};}
for(const [paperId,content] of [['listening',createDefaultMoverListeningContent()],['reading-writing',createDefaultMoverReadingWritingContent()]])cases['mover-'+paperId]={kind:paperId==='listening'?'listening':'reading',moduleId:'mover',paperId,playable:{id:'qa-mover-'+paperId,versionId:'qa-version',title:'Movers '+paperId,description:'A1 Movers',level:'A1 Movers',timeLimitMinutes:0,content}};
const definition=getExamPaperDefinition('writing','writing');cases['standalone-writing']={kind:'generic',moduleId:'writing',paperId:'writing',playable:{id:'qa-standalone',versionId:'qa-version',title:'Standalone writing',timeLimitMinutes:0,content:createDefaultExamContent(definition)}};
fs.writeFileSync('.data/exam-background-all-qa/fixture.json',JSON.stringify(cases));console.log('Actual default-content fixtures: '+Object.keys(cases).length);
