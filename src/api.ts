import { invoke, isTauri } from '@tauri-apps/api/core';
export interface Parameters { targetSpeed: number; currentLimit: number; kp: number; ki: number }
export interface Sample { time: number; speed: number; current: number; voltage: number; temperature: number }
export interface Endpoint { id: string; name: string; kind: string }
export const desktop = isTauri();
const defaults = (): Parameters => ({targetSpeed:1500,currentLimit:8,kp:0.12,ki:0.8});
let params = defaults(), connected = false, time = 0, speed = 0;
export function validate(p: Parameters) {
  for (const [key,min,max] of [['targetSpeed',0,6000],['currentLimit',0.1,20],['kp',0,10],['ki',0,100]] as const) {
    if (!Number.isFinite(p[key]) || p[key] < min || p[key] > max) throw new Error(key + ' 超出有效范围');
  }
}
export const api = {
  async connect(): Promise<Parameters> {
    if (desktop) return invoke('connect_simulator');
    connected = true; time = 0; speed = 0; params = defaults(); return {...params};
  },
  async disconnect() { if (desktop) await invoke('disconnect'); else connected = false; },
  async read(): Promise<Parameters> {
    if (desktop) return invoke('read_parameters');
    if (!connected) throw new Error('设备未连接'); return {...params};
  },
  async write(value: Parameters) {
    validate(value);
    if (desktop) return invoke('write_parameters', {params:value});
    if (!connected) throw new Error('设备未连接'); params = {...value};
  },
  async sample(): Promise<Sample> {
    if (desktop) return invoke('sample');
    if (!connected) throw new Error('设备未连接');
    time += 0.05; speed += (params.targetSpeed-speed)*(1-Math.exp(-0.1));
    return {time,speed:speed+Math.sin(time*3)*12,current:Math.min(params.currentLimit,1.8+Math.sin(time*4)*0.25),voltage:24+Math.sin(time*1.7)*0.08,temperature:32+Math.sin(time*0.15)*0.5};
  },
  async discover(kind:string): Promise<Endpoint[]> {
    if (!desktop) throw new Error('硬件扫描需要在 Tauri 桌面应用中运行');
    return invoke('discover', {kind});
  }
};
