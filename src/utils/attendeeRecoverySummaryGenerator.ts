
import { AttendeeRecoveryDiagnostics, DiagnosticsSummary } from '@/types/attendeeRecoveryDiagnostics';

// Generate enhanced summary statistics with data integrity metrics
export const generateRecoverySummary = (diagnostics: AttendeeRecoveryDiagnostics[]): DiagnosticsSummary => {
  const totalWebinars = diagnostics.length;
  const totalExpected = diagnostics.reduce((sum, d) => sum + d.expected_attendees, 0);
  const totalActual = diagnostics.reduce((sum, d) => sum + d.actual_attendees, 0);
  const totalGap = totalExpected - totalActual;
  const averageGapPercentage = totalWebinars > 0 ? 
    diagnostics.reduce((sum, d) => sum + d.gap_percentage, 0) / totalWebinars : 0;

  const highGapWebinars = diagnostics.filter(d => d.gap_percentage > 30).length;
  const zeroAttendeeWebinars = diagnostics.filter(d => d.actual_attendees === 0).length;
  
  // Enhanced integrity metrics
  const totalBots = diagnostics.reduce((sum, d) => sum + d.filtering_stats.bots_filtered, 0);
  const totalInvalidEmails = diagnostics.reduce((sum, d) => sum + d.filtering_stats.invalid_emails, 0);
  const totalDatabaseErrors = diagnostics.reduce((sum, d) => sum + d.error_stats.database_errors, 0);
  const totalConstraintViolations = diagnostics.reduce((sum, d) => sum + d.error_stats.constraint_violations, 0);

  return {
    totalWebinars,
    totalExpected,
    totalActual,
    totalGap,
    averageGapPercentage: Math.round(averageGapPercentage * 100) / 100,
    highGapWebinars,
    zeroAttendeeWebinars,
    recoveryPotential: Math.min(totalGap, totalExpected * 0.8), // Conservative estimate
    // Data integrity metrics
    totalFiltered: totalBots + totalInvalidEmails,
    totalErrors: totalDatabaseErrors + totalConstraintViolations,
    errorBreakdown: {
      databaseErrors: totalDatabaseErrors,
      constraintViolations: totalConstraintViolations,
      filteringRate: totalActual > 0 ? Math.round((totalBots + totalInvalidEmails) / totalActual * 100) / 100 : 0
    }
  };
};
