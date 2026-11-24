// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("MoyuReader2 异常崩溃:\n{}\n", info);
        let _ = std::fs::write("crash.log", &msg);
        eprintln!("{}", msg);
    }));

    moyu_reader_lib::run();
}
