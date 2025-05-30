
// Utility to check database constraints and provide proper conflict resolution
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

    return constraints;
  } catch (error) {
    console.error('[constraintChecker] Failed to check constraints:', error);
    return null;
  }
}

export function determineConflictColumns(constraints: any[]): string {
  if (!constraints || constraints.length === 0) {
    // Fallback to the most logical unique constraint
    return 'organization_id,webinar_id,zoom_user_id';
  }

  // Look for the most specific unique constraint that includes webinar and user identification
  for (const constraint of constraints) {
    if (constraint.constraint_type === 'UNIQUE') {
      const columns = constraint.columns.toLowerCase();
      
      // Priority order for conflict resolution
      if (columns.includes('webinar_id') && columns.includes('zoom_user_id')) {
        return constraint.columns;
      }
      if (columns.includes('webinar_id') && columns.includes('email')) {
        return constraint.columns;
      }
    }
  }

  // Fallback
  return 'organization_id,webinar_id,zoom_user_id';
}
