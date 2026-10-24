use host_core::{DeviceDriver, Parameters, Sample, SimulatedDevice};
use std::sync::Mutex;
use tauri::State;
#[derive(Default)]
struct Session(Mutex<Option<SimulatedDevice>>);
#[tauri::command]
fn connect_simulator(session: State<Session>) -> Result<Parameters, String> {
    let mut guard = session.0.lock().map_err(|e| e.to_string())?;
    let device = SimulatedDevice::default();
    let params = device.read_parameters();
    *guard = Some(device);
    Ok(params)
}
#[tauri::command]
fn disconnect(session: State<Session>) -> Result<(), String> {
    *session.0.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}
#[tauri::command]
fn read_parameters(session: State<Session>) -> Result<Parameters, String> {
    session
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .as_ref()
        .map(|d| d.read_parameters())
        .ok_or("设备未连接".into())
}
#[tauri::command]
fn write_parameters(params: Parameters, session: State<Session>) -> Result<(), String> {
    session
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .as_mut()
        .ok_or("设备未连接")?
        .write_parameters(params)
}
#[tauri::command]
fn sample(session: State<Session>) -> Result<Sample, String> {
    Ok(session
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .as_mut()
        .ok_or("设备未连接")?
        .sample(0.05))
}
#[tauri::command]
async fn discover(kind: String) -> Result<Vec<host_transport::Endpoint>, String> {
    host_transport::discover(&kind)
        .await
        .map_err(|e| e.to_string())
}
pub fn run() {
    tauri::Builder::default()
        .manage(Session::default())
        .invoke_handler(tauri::generate_handler![
            connect_simulator,
            disconnect,
            read_parameters,
            write_parameters,
            sample,
            discover
        ])
        .run(tauri::generate_context!())
        .expect("启动 Host Studio 失败");
}
