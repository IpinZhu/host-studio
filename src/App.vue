<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import { Activity, Cable, Bluetooth, Wifi, Usb, Settings2, Bell, LayoutGrid, Moon, Sun, Plus, ChevronDown, ChevronRight, RefreshCw, SlidersHorizontal, Terminal, Trash2, Download, Play, Square, CircleHelp, Cpu, Check, Radio, ArrowUpRight, Unplug, Circle, Save, FolderOpen, X } from 'lucide-vue-next';
import { api, desktop, validate, type Parameters, type Sample, type Endpoint } from './api';
const tab = ref('设备工作台');
const tabs = ['设备工作台','参数配置','数据记录'];
const connected = ref(false), busy = ref(false), scanning = ref(false), running = ref(false), recording = ref(false), dark = ref(false);
const transport = ref('mock'), endpoint = ref(''), endpoints = ref<Endpoint[]>([]), showHelp = ref(false);
const params = reactive<Parameters>({targetSpeed:1500,currentLimit:8,kp:0.12,ki:0.8});
const saved = ref(JSON.stringify(params));
const dirty = computed(()=>JSON.stringify(params)!==saved.value);
const latest = ref<Sample>();
const history = ref<Sample[]>([]), records = ref<Sample[]>([]);
const canvas = ref<HTMLCanvasElement>(), fileInput = ref<HTMLInputElement>();
const logs = ref<{time:string;message:string;level:string}[]>([]);
const sections = reactive({wave:true,params:true,logs:true,connection:true});
let timer: ReturnType<typeof setTimeout> | undefined, generation = 0;
const colors = ['#368a50','#87a9e1'];
const metrics = computed(()=>[
  {label:'实际转速',value:latest.value?.speed.toFixed(0) ?? '—',unit:'rpm',note:'速度反馈',color:'green'},
  {label:'母线电压',value:latest.value?.voltage.toFixed(2) ?? '—',unit:'V',note:'直流输入',color:'blue'},
  {label:'相电流',value:latest.value?.current.toFixed(2) ?? '—',unit:'A',note:'模拟有效值',color:'purple'},
  {label:'设备温度',value:latest.value?.temperature.toFixed(1) ?? '—',unit:'°C',note:'板载传感器',color:'orange'}
]);
function log(message:string,level='info') {
  logs.value.push({time:new Date().toLocaleTimeString('zh-CN',{hour12:false}),message,level});
  if(logs.value.length>200) logs.value.shift();
}
function fail(e:unknown) { log(String(e),'error'); }
async function connect() {
  busy.value=true;
  try {
    if(connected.value) {
      stop(); await api.disconnect(); connected.value=false; latest.value=undefined; history.value=[]; draw(); log('设备已断开');
    } else {
      Object.assign(params,await api.connect()); saved.value=JSON.stringify(params); connected.value=true;
      log('模拟设备已连接 · FOC Demo / 协议示例 v1','success');
    }
  } catch(e){fail(e)} finally {busy.value=false}
}
async function scan() {
  scanning.value=true; endpoints.value=[]; endpoint.value='';
  try { endpoints.value=await api.discover(transport.value); endpoint.value=endpoints.value[0]?.id ?? ''; log('扫描完成，发现 '+endpoints.value.length+' 个端点'); }
  catch(e){fail(e)} finally {scanning.value=false}
}
function stop() { running.value=false; generation++; clearTimeout(timer); if(recording.value){recording.value=false;log('录制已停止，共 '+records.value.length+' 帧');} }
async function tick(token:number) {
  if(!running.value || token!==generation)return;
  try {
    const value=await api.sample();
    if(!running.value || token!==generation)return;
    latest.value=value; history.value.push(value); if(history.value.length>240)history.value.shift();
    if(recording.value) {
      records.value.push(value);
      if(records.value.length>=12000){recording.value=false;log('已达到 12,000 帧录制上限，请导出数据','warning');}
    }
    draw();
  } catch(e) {fail(e);stop();return}
  timer=setTimeout(()=>tick(token),50);
}
function toggleRun() {
  if(running.value){stop();log('采集已暂停');}
  else {running.value=true;log('开始采集模拟遥测 · 目标 20 Hz','success');void tick(++generation);}
}
function toggleRecording(){
  if(recording.value){recording.value=false;log('录制已停止，共 '+records.value.length+' 帧');}
  else {records.value=[];recording.value=true;log('开始录制；仅记录当前采集的数据');}
}
async function readParams(){try {Object.assign(params,await api.read());saved.value=JSON.stringify(params);log('参数已从模拟设备读取','success')}catch(e){fail(e)}}
async function writeParams(){try {validate(params);await api.write({...params});saved.value=JSON.stringify(params);log('参数已应用到模拟设备（未写入 Flash）','success')}catch(e){fail(e)}}
function download(name:string,body:string,type='text/plain'){
  const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportCsv(){download('host-recording.csv','time_s,speed_rpm,current_A,voltage_V,temperature_C\n'+records.value.map(s=>[s.time,s.speed,s.current,s.voltage,s.temperature].join(',')).join('\n'),'text/csv');log('已导出 '+records.value.length+' 帧 CSV');}
async function importParams(event:Event){
  const input=event.target as HTMLInputElement;
  try {
    const file=input.files?.[0];if(!file)return;
    if(file.size>65536)throw new Error('参数文件不得超过 64 KB');
    const value=JSON.parse(await file.text());validate(value);
    Object.assign(params,{targetSpeed:value.targetSpeed,currentLimit:value.currentLimit,kp:value.kp,ki:value.ki});
    log('参数已导入编辑区，点击“应用参数”后生效');
  }catch(e){fail(e)}finally{input.value=''}
}
function draw(){
  const el=canvas.value;if(!el)return;
  const rect=el.getBoundingClientRect();if(!rect.width)return;
  const dpr=window.devicePixelRatio||1;el.width=rect.width*dpr;el.height=rect.height*dpr;
  const ctx=el.getContext('2d');if(!ctx)return;ctx.scale(dpr,dpr);
  const w=rect.width,h=rect.height,left=43,right=18,top=20,bottom=28;
  ctx.font='11px Segoe UI';ctx.textAlign='right';
  const max=Math.max(2000,Math.ceil(Math.max(params.targetSpeed,...history.value.map(s=>s.speed))/1000)*1000);
  for(let i=0;i<=4;i++){
    const y=top+(h-top-bottom)*i/4;ctx.strokeStyle=dark.value?'#303a35':'#edf0ee';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();
    ctx.fillStyle='#929a94';ctx.fillText(String(Math.round(max*(1-i/4))),left-9,y+4);
  }
  ctx.textAlign='center';
  for(let i=0;i<=5;i++){
    const x=left+(w-left-right)*i/5;ctx.fillStyle='#929a94';ctx.fillText((Math.max(0,(latest.value?.time??12)-12)+i*2.4).toFixed(1)+'s',x,h-6);
  }
  if(!history.value.length)return;
  for(let channel=0;channel<2;channel++){
    ctx.strokeStyle=colors[channel];ctx.lineWidth=2;ctx.beginPath();
    history.value.forEach((s,i)=>{const x=left+(w-left-right)*i/239;const v=channel===0?s.speed:s.current/20*max;const y=top+(h-top-bottom)*(1-v/max);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();
  }
}
let observer:ResizeObserver;
onMounted(()=>{log(desktop?'桌面运行环境就绪':'浏览器预览模式 · 硬件扫描需启动桌面应用');log('选择模拟设备，连接后开始采集');observer=new ResizeObserver(draw);if(canvas.value)observer.observe(canvas.value);draw();});
onUnmounted(()=>{stop();observer?.disconnect();void api.disconnect();});
function switchTab(value:string){tab.value=value;nextTick(draw);}
function toggleTheme(){dark.value=!dark.value;nextTick(draw);}
</script>

<template>
<div class="app" :class="{dark}">
  <header class="titlebar"><div class="brand-icon"><Activity :size="19"/></div><strong>Host Studio</strong><span class="version">v0.1.0</span><span class="title-caption">嵌入式设备工作台</span><span class="preview-badge">{{desktop?'DESKTOP':'WEB PREVIEW'}}</span></header>
  <nav class="topnav">
    <div class="tabs"><button v-for="item in tabs" :key="item" :class="{active:tab===item}" @click="switchTab(item)">{{item}}</button><button class="add-tab" title="框架扩展说明" @click="showHelp=true"><Plus :size="19"/></button></div>
    <div class="nav-tools"><span class="workspace"><span class="tiny-dot"></span>默认工作空间</span><button title="查看运行日志" @click="sections.logs=true;log('通知与错误显示在右侧运行日志中')"><Bell :size="19"/></button><button title="框架说明" @click="showHelp=true"><LayoutGrid :size="19"/></button><button title="切换明暗主题" @click="toggleTheme"><Sun v-if="dark" :size="19"/><Moon v-else :size="19"/></button><button title="连接设置" @click="sections.connection=!sections.connection"><Settings2 :size="19"/></button></div>
  </nav>
  <div class="body">
    <main class="main">
      <div class="page-heading"><div><div class="eyebrow">DEVICE WORKSPACE</div><h1>{{tab==='设备工作台'?'让设备状态，一目了然。':tab==='参数配置'?'每一个参数，尽在掌握。':'把每一次调试，记录下来。'}}</h1><p>{{tab==='设备工作台'?'连接、观察与调试，在同一个工作空间完成。':tab==='参数配置'?'描述式参数模型 · 范围校验 · 配置导入与导出':'采集数据保留在本次会话中，可导出 CSV 继续分析。'}}</p></div><span class="outlined-badge"><Cpu :size="14"/>FOC 示例项目</span></div>
      <div class="device-strip"><div class="device-icon"><Cpu :size="23"/></div><div><strong>{{connected?'FOC Demo Controller':'尚未连接设备'}}</strong><span>{{connected?'模拟设备 · host-sim-001':'从右侧选择连接方式，开始你的调试工作'}}</span></div><span class="connection-pill" :class="{online:connected}"><span class="tiny-dot"></span>{{connected?'模拟连接':'离线'}}</span></div>
      <template v-if="tab==='设备工作台'">
        <div class="metrics"><div class="metric" v-for="m in metrics" :key="m.label"><div class="metric-label">{{m.label}}<span class="metric-dot" :class="m.color"></span></div><div class="metric-value">{{m.value}}<small>{{m.unit}}</small></div><div class="metric-note">{{m.note}}</div></div></div>
      </template>
      <section v-show="tab==='设备工作台'" class="card waveform">
        <div class="card-heading"><button class="section-title" @click="sections.wave=!sections.wave"><Activity :size="19"/><strong>实时波形</strong><span class="subtle-tag">TELEMETRY</span></button><div class="heading-actions"><span class="live" :class="{on:running}"><span class="tiny-dot"></span>{{running?'采集中':'已暂停'}}</span><button title="折叠波形" @click="sections.wave=!sections.wave"><ChevronDown :size="18" :class="{rotated:!sections.wave}"/></button></div></div>
        <div v-show="sections.wave" class="wave-content"><div class="chart-toolbar"><div class="legend"><span><i></i>转速 <small>rpm</small></span><span><i class="blue"></i>相电流 <small>0–20 A / 归一化</small></span></div><span class="chart-range">最近 12 秒</span></div><div class="chart"><canvas ref="canvas" aria-label="转速与电流实时曲线"></canvas><div v-if="!history.length" class="chart-empty"><Activity :size="27"/><strong>等待遥测数据</strong><span>连接模拟设备后，点击「开始采集」</span></div></div><div class="chart-footer"><span><span class="tiny-dot"></span>目标采样率 20 Hz</span><span>缓冲 {{history.length}} / 240 帧</span></div></div>
      </section>
      <section v-if="tab!=='数据记录'" class="card parameters">
        <div class="card-heading"><button class="section-title" @click="sections.params=!sections.params"><SlidersHorizontal :size="19"/><strong>设备参数</strong><span class="subtle-tag" :class="{changed:dirty}">{{dirty?'待应用':'BASIC'}}</span></button><button title="折叠参数" @click="sections.params=!sections.params"><ChevronDown :size="18" :class="{rotated:!sections.params}"/></button></div>
        <div v-show="sections.params"><div class="param-grid"><label><span>目标转速 <small>0–6000 rpm</small></span><div class="input-unit"><input type="number" v-model.number="params.targetSpeed" min="0" max="6000" step="100"><span>rpm</span></div></label><label><span>电流限制 <small>0.1–20 A</small></span><div class="input-unit"><input type="number" v-model.number="params.currentLimit" min="0.1" max="20" step="0.1"><span>A</span></div></label><label v-if="tab==='参数配置'"><span>比例增益 Kp <small>0–10</small></span><input type="number" v-model.number="params.kp" min="0" max="10" step="0.01"></label><label v-if="tab==='参数配置'"><span>积分增益 Ki <small>0–100</small></span><input type="number" v-model.number="params.ki" min="0" max="100" step="0.1"></label></div><div class="param-footer"><span><CircleHelp :size="14"/>参数应用至模拟器，不驱动真实硬件</span><button class="text-button" :disabled="!connected" @click="readParams">读取参数</button><button class="soft-button" :disabled="!connected" @click="writeParams"><Check :size="15"/>应用参数</button></div></div>
      </section>
      <section v-if="tab==='参数配置'" class="card extra-card"><div><h3>参数配置文件</h3><p>将当前参数保存为 JSON，或导入已有配置。导入后需手动应用。</p></div><div class="button-row"><button class="secondary" @click="download('host-parameters.json',JSON.stringify(params,null,2),'application/json')"><Save :size="16"/>导出配置</button><button class="secondary" @click="fileInput?.click()"><FolderOpen :size="16"/>导入配置</button></div><input ref="fileInput" type="file" accept=".json" hidden @change="importParams"></section>
      <section v-if="tab==='数据记录'" class="card extra-card"><div><div class="eyebrow">SESSION RECORDING</div><h2>{{records.length.toLocaleString()}} <small>帧已记录</small></h2><p>最多保留 12,000 帧，达到上限后自动停止录制。关闭页面前请导出。</p></div><div class="button-row"><button class="secondary" :disabled="!running" @click="toggleRecording"><Circle :size="15"/>{{recording?'停止录制':'开始新录制'}}</button><button class="soft-button" :disabled="!records.length" @click="exportCsv"><Download :size="16"/>导出 CSV</button></div><table v-if="records.length"><thead><tr><th>时间 / s</th><th>转速 / rpm</th><th>电流 / A</th><th>电压 / V</th></tr></thead><tbody><tr v-for="s in records.slice(-8)" :key="s.time"><td>{{s.time.toFixed(2)}}</td><td>{{s.speed.toFixed(1)}}</td><td>{{s.current.toFixed(3)}}</td><td>{{s.voltage.toFixed(3)}}</td></tr></tbody></table></section>
      <div class="workspace-note"><span class="tiny-dot"></span>模块化设备框架<span>Rust + Tauri 2</span><ArrowUpRight :size="13"/></div>
    </main>
    <aside class="sidebar">
      <section class="card connection-card"><div class="card-heading"><button class="section-title" @click="sections.connection=!sections.connection"><Settings2 :size="19"/><strong>连接设置</strong></button><button title="折叠连接设置" @click="sections.connection=!sections.connection"><ChevronDown :size="18" :class="{rotated:!sections.connection}"/></button></div><div v-show="sections.connection" class="connection-body">
        <div class="field-heading">通信方式<span>{{connected?'已锁定连接':'选择连接适配器'}}</span></div>
        <div class="transport-grid"><button v-for="t in [{id:'serial',name:'USB 串口',icon:Cable},{id:'usb',name:'USB HID',icon:Usb},{id:'ble',name:'蓝牙 BLE',icon:Bluetooth},{id:'wifi',name:'Wi-Fi',icon:Wifi}]" :key="t.id" :class="{selected:transport===t.id}" :disabled="connected||scanning" @click="transport=t.id;endpoints=[];endpoint=''"><component :is="t.icon" :size="18"/>{{t.name}}</button></div>
        <button class="sim-option" :class="{selected:transport==='mock'}" :disabled="connected||scanning" @click="transport='mock'"><Cpu :size="17"/><span>模拟设备</span><span class="recommended">无需硬件</span><Check v-if="transport==='mock'" :size="15"/></button>
        <div class="divider"></div><label class="field-heading">设备端点</label>
        <div class="endpoint-row"><select v-if="transport==='mock'" disabled><option>FOC Demo Controller</option></select><input v-else-if="transport==='wifi'" placeholder="192.168.4.1:9000" v-model="endpoint"><select v-else v-model="endpoint"><option value="">{{scanning?'正在扫描…':'请选择扫描到的设备'}}</option><option v-for="e in endpoints" :key="e.id" :value="e.id">{{e.name}}</option></select><button class="refresh" :disabled="transport==='mock'||transport==='wifi'||scanning||connected" title="扫描设备" @click="scan"><RefreshCw :size="17" :class="{spinning:scanning}"/></button></div>
        <div v-if="transport==='serial'" class="serial-info"><span>默认波特率</span><strong>115200</strong></div>
        <p class="connection-help">{{transport==='mock'?'内置 FOC 模拟器，可体验参数调节与实时遥测。':'底层通信适配器已提供。真实设备需配置协议适配包，当前工作台仅开放扫描。'}}</p>
        <button class="connect-button" :disabled="busy||transport!=='mock'" @click="connect"><Unplug v-if="connected" :size="17"/><Radio v-else :size="17"/>{{busy?'正在处理…':connected?'断开连接':'连接设备'}}</button>
      </div></section>
      <section class="card session-card"><div class="section-title"><Cpu :size="18"/><strong>设备信息</strong><span class="subtle-tag">DEMO</span></div><dl><div><dt>设备型号</dt><dd>{{connected?'FOC Demo':'—'}}</dd></div><div><dt>协议版本</dt><dd>{{connected?'示例模型 v1':'—'}}</dd></div><div><dt>当前链路</dt><dd>{{connected?'本地模拟器':'未连接'}}</dd></div></dl></section>
      <section class="card logs-card"><div class="card-heading"><button class="section-title" @click="sections.logs=!sections.logs"><Terminal :size="18"/><strong>运行日志</strong><span class="log-count">{{logs.length}}</span></button><div class="heading-actions"><button title="导出日志" :disabled="!logs.length" @click="download('host-studio.log',logs.map(l=>l.time+' ['+l.level+'] '+l.message).join('\n'))"><Download :size="16"/></button><button title="清空日志" @click="logs=[]"><Trash2 :size="16"/></button></div></div><div v-show="sections.logs" class="log-content"><div v-for="(entry,i) in [...logs].reverse()" :key="logs.length-i" class="log-entry" :class="entry.level"><time>{{entry.time}}</time><p>{{entry.message}}</p></div><p class="empty-logs" v-if="!logs.length">暂无日志</p></div></section>
      <div class="sidebar-bottom"><span class="tiny-dot"></span>本地运行 · 数据由你掌握</div>
    </aside>
  </div>
  <footer class="bottom-bar"><div class="status"><span class="tiny-dot" :class="{green:connected}"></span>{{connected?'模拟设备已连接':'等待设备连接'}}<span class="footer-divider"></span><span>{{running?'遥测采集中':'工作空间就绪'}}</span></div><div class="bottom-actions"><button class="text-button" :disabled="!running" @click="toggleRecording"><Circle :size="16" :class="{recording}"/>{{recording?'停止录制':'录制数据'}}</button><button class="text-button export-action" :disabled="!records.length" @click="exportCsv"><Download :size="16"/>导出</button><button class="primary" :disabled="!connected" @click="toggleRun"><Square v-if="running" :size="18"/><Play v-else :size="19"/>{{running?'暂停采集':'开始采集'}}</button></div></footer>
  <div v-if="showHelp" class="modal-overlay" @click.self="showHelp=false"><section class="card modal"><button class="close" title="关闭说明" @click="showHelp=false"><X :size="20"/></button><div class="brand-icon"><Activity :size="22"/></div><h2>为下一台设备，准备好。</h2><p>Host Studio 将通信适配、设备协议与工作台界面分开。新项目可复用连接设置、参数编辑、遥测与记录组件。</p><p>本版本内置 FOC 模拟器。串口、TCP/UDP、USB HID、BLE 提供 Rust 底层适配；连接真实设备前需实现对应协议、握手与设备身份校验。USB Bulk 为后续扩展。</p><button class="primary" @click="showHelp=false">开始探索<ChevronRight :size="17"/></button></section></div>
</div>
</template>
