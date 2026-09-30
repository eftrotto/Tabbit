// Funções puras de tempo, separadas para poder testar sem blockchain.
use crate::errors::TabbitError;
use anchor_lang::prelude::*;

pub const SECONDS_PER_DAY: i64 = 86_400;
pub const MINUTES_PER_DAY: u16 = 1_440;

/// Converte o timestamp UTC para (dia local, minuto do dia local) usando o fuso da empresa.
pub fn local_day_and_minute(unix_ts: i64, tz_offset_minutes: i16) -> (i64, u16) {
    let local = unix_ts + (tz_offset_minutes as i64) * 60;
    let day = local.div_euclid(SECONDS_PER_DAY);
    let minute = (local.rem_euclid(SECONDS_PER_DAY) / 60) as u16;
    (day, minute)
}

/// Janela válida: ambos 0 (sem janela) ou início < fim, ambos até 1440.
pub fn validate_window(start: u16, end: u16) -> Result<()> {
    if start == 0 && end == 0 {
        return Ok(());
    }
    require!(start < end && end <= MINUTES_PER_DAY, TabbitError::InvalidWindow);
    Ok(())
}

/// true se o minuto está dentro da janela (ou se não há janela). Fim exclusivo.
pub fn is_within_window(minute: u16, start: u16, end: u16) -> bool {
    if start == 0 && end == 0 {
        return true;
    }
    minute >= start && minute < end
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn brasilia_offset() {
        // 2026-10-01 14:00:00 UTC = 11:00 em Brasília
        let ts = 1_790_863_200;
        let (_, minute) = local_day_and_minute(ts, -180);
        assert_eq!(minute, 11 * 60);
    }

    #[test]
    fn day_changes_at_local_midnight() {
        // 02:59 UTC = 23:59 do dia anterior em Brasília; 03:00 UTC = 00:00 local
        let midnight_utc = 1_790_812_800; // 2026-10-01 00:00:00 UTC
        let (d1, m1) = local_day_and_minute(midnight_utc + 2 * 3600 + 59 * 60, -180);
        let (d2, m2) = local_day_and_minute(midnight_utc + 3 * 3600, -180);
        assert_eq!(m1, 23 * 60 + 59);
        assert_eq!(m2, 0);
        assert_eq!(d2, d1 + 1);
    }

    #[test]
    fn window_rules() {
        assert!(validate_window(0, 0).is_ok());
        assert!(validate_window(660, 900).is_ok());
        assert!(validate_window(900, 660).is_err());
        assert!(validate_window(0, 1441).is_err());
        assert!(is_within_window(700, 660, 900));
        assert!(!is_within_window(900, 660, 900));
        assert!(!is_within_window(659, 660, 900));
        assert!(is_within_window(5, 0, 0));
    }
}
