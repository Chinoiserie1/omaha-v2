use pinocchio::account_info::AccountInfo;
use pinocchio::program_error::ProgramError;

/// Clock sysvar ID: `SysvarC1ock11111111111111111111111111111111`.
pub const CLOCK_SYSVAR_ID: [u8; 32] = [
    6, 167, 213, 23, 24, 199, 116, 201, 40, 86, 99, 152, 105, 29, 94, 182,
    139, 94, 184, 163, 155, 75, 109, 92, 115, 85, 91, 33, 0, 0, 0, 0,
];

/// Offset of `unix_timestamp` (i64 LE) within Clock sysvar data.
/// Layout: slot(8) + epoch_start_timestamp(8) + epoch(8) + leader_schedule_epoch(8) + unix_timestamp(8)
const CLOCK_UNIX_TIMESTAMP_OFFSET: usize = 32;

/// Read the `unix_timestamp` from a Clock sysvar account.
///
/// Validates that the account key matches the Clock sysvar ID.
pub fn read_clock_timestamp(clock_account: &AccountInfo) -> Result<i64, ProgramError> {
    if clock_account.key().as_ref() != &CLOCK_SYSVAR_ID {
        return Err(ProgramError::InvalidAccountData);
    }

    let data = clock_account.try_borrow_data()?;
    if data.len() < CLOCK_UNIX_TIMESTAMP_OFFSET + 8 {
        return Err(ProgramError::InvalidAccountData);
    }

    let timestamp = i64::from_le_bytes(
        data[CLOCK_UNIX_TIMESTAMP_OFFSET..CLOCK_UNIX_TIMESTAMP_OFFSET + 8]
            .try_into()
            .map_err(|_| ProgramError::InvalidAccountData)?,
    );

    Ok(timestamp)
}
