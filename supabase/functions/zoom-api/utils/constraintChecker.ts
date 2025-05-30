
// Utility functions for database constraint management
// Note: As of the latest update, unique constraints on attendees table have been removed
// to allow storing multiple attendance records per person per webinar for accurate time tracking

export async function getAttendeesTableConstraints(supabase: any) {
  try {
    // Query to get all constraints on the attendees table
    const { data: constraints, error } = await supabase.rpc('exec', {
      sql: `
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) as columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'attendees' 
          AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
        GROUP BY tc.constraint_name, tc.constraint_type
        ORDER BY tc.constraint_type, tc.constraint_name
      `
    });

    if (error) {
      console.error('[constraintChecker] Error fetching constraints:', error);
      return null;
    }

    console.log('[constraintChecker] Current attendees table constraints:', constraints);
    return constraints;
  } catch (error) {
    console.error('[constraintChecker] Failed to check constraints:', error);
    return null;
  }
}

// This function is now deprecated since we're using INSERT instead of UPSERT
export function determineConflictColumns(constraints: any[]): string {
  console.log('[constraintChecker] Note: determineConflictColumns is deprecated - using INSERT operations instead of UPSERT');
  
  if (!constraints || constraints.length === 0) {
    console.log('[constraintChecker] No unique constraints found - multiple records per person per webinar are now allowed');
    return '';
  }

  // Log remaining constraints for informational purposes
  for (const constraint of constraints) {
    console.log(`[constraintChecker] Found constraint: ${constraint.constraint_name} (${constraint.constraint_type}) on columns: ${constraint.columns}`);
  }
  
  return '';
}
