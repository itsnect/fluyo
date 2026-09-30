"use strict";
/* FLUYO-009 — Tests del playback puro de Scenarios.
   Sin DOM ni Canvas: node --test test/scenario-playback.test.cjs */

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function makePlayback(){
  const context=vm.createContext({
    console, performance:{now:()=>0},
    Math, Number, Array, Object, Set, Map, JSON, Error
  });
  vm.runInContext(read('js/scenario-playback.js'), context);
  return context.FluyoScenarioPlayback;
}

const CANONICAL_TRACE={
  engineVersion:1,
  scenarioId:1,
  events:[
    {at:0, type:"state_changed", stepId:1, nodeId:2, from:"UP", to:"DOWN"},
    {at:1000, type:"send_started", stepId:2, edgeId:5},
    {at:1000, type:"send_failed", stepId:2, edgeId:5, reason:"target_down"},
    {at:5000, type:"state_changed", stepId:3, nodeId:2, from:"DOWN", to:"UP"},
    {at:6000, type:"send_started", stepId:4, edgeId:5},
    {at:6000, type:"send_succeeded", stepId:4, edgeId:5}
  ]
};

test('Playback arranca con estados vacíos y consume eventos',()=>{
  const P=makePlayback();
  const pb=P.makePlayback(CANONICAL_TRACE);
  pb.startedAtReal = 0;
  const rs=P.tick(pb, 0);
  assert.equal(rs.virtualTime, 0);
  assert.equal(rs.logEvents.length, 1);
  assert.equal(rs.nodeStates[2], "DOWN");
});

test('SEND same-timestamp genera partícula activa y terminal diferida',()=>{
  const P=makePlayback();
  const pb=P.makePlayback(CANONICAL_TRACE);
  pb.startedAtReal = 0;
  P.tick(pb, 1000);
  assert.equal(pb.activeSends.length, 1);
  assert.equal(pb.completedSends.length, 0);
  const rs=P.tick(pb, 1000 + P.SEND_PARTICLE_MS); // duración real de la partícula
  assert.equal(pb.activeSends.length, 0);
  assert.equal(pb.completedSends.length, 1);
  assert.equal(rs.completedSends[0].terminalType, "send_failed");
});

test('Terminal expira tras TERMINAL_MS',()=>{
  const P=makePlayback();
  const pb=P.makePlayback(CANONICAL_TRACE);
  pb.startedAtReal = 0;
  const done = 1000 + P.SEND_PARTICLE_MS;
  P.tick(pb, done);
  assert.equal(pb.completedSends.length, 1);
  P.tick(pb, done + P.TERMINAL_MS);
  assert.equal(pb.completedSends.length, 0);
});

test('Playback no muta Trace',()=>{
  const P=makePlayback();
  const trace=JSON.parse(JSON.stringify(CANONICAL_TRACE));
  const pb=P.makePlayback(trace);
  pb.startedAtReal = 0;
  P.tick(pb, 7000);
  assert.equal(JSON.stringify(trace), JSON.stringify(CANONICAL_TRACE));
});

test('finished es true tras último evento y efectos visuales',()=>{
  const P=makePlayback();
  const pb=P.makePlayback(CANONICAL_TRACE);
  pb.startedAtReal = 0;
  P.tick(pb, 6000);
  assert.equal(pb.activeSends.length, 1); // aún en partícula
  const rs=P.tick(pb, 6000 + P.SEND_PARTICLE_MS + P.TERMINAL_MS + 50);
  assert.equal(rs.finished, true);
});

test('Playback sin Trace vacío finaliza inmediatamente',()=>{
  const P=makePlayback();
  const pb=P.makePlayback({engineVersion:1, scenarioId:1, events:[]});
  pb.startedAtReal = 0;
  const rs=P.tick(pb, 0);
  assert.equal(rs.finished, true);
  assert.equal(rs.logEvents.length, 0);
});

test('Log muestra eventos en orden virtual',()=>{
  const P=makePlayback();
  const pb=P.makePlayback(CANONICAL_TRACE);
  pb.startedAtReal = 0;
  const rs=P.tick(pb, 7000);
  const types=rs.logEvents.map(e=>e.type);
  assert.equal(JSON.stringify(types), JSON.stringify(["state_changed","send_started","send_failed","state_changed","send_started","send_succeeded"]));
});

test('Dos SEND consecutivos generan dos partículas independientes',()=>{
  const P=makePlayback();
  const trace={
    engineVersion:1, scenarioId:1,
    events:[
      {at:0, type:"send_started", stepId:1, edgeId:5},
      {at:0, type:"send_succeeded", stepId:1, edgeId:5},
      {at:0, type:"send_started", stepId:2, edgeId:5},
      {at:0, type:"send_succeeded", stepId:2, edgeId:5}
    ]
  };
  const pb=P.makePlayback(trace);
  pb.startedAtReal = 0;
  const rs=P.tick(pb, 0);
  assert.equal(rs.activeSends.length, 2);
  assert.equal(rs.logEvents.length, 4);
});
