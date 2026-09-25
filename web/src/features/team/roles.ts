/** Etiquetas del puesto, no roles de acceso ni permisos del sistema. */
export const EMPLOYEE_ROLES = ['Barbero/a', 'Estilista', 'Terapeuta', 'Manicurista', 'Especialista en pestañas', 'Recepción'] as const;
const legacyLabels: Record<string,string> = {
  Barber: 'Barbero/a', Stylist: 'Estilista', Therapist: 'Terapeuta',
  'Nail Artist': 'Manicurista', 'Lash Artist': 'Especialista en pestañas',
};
export function employeeRoleLabel(role:string):string {
  return Object.prototype.hasOwnProperty.call(legacyLabels,role) ? legacyLabels[role]! : role;
}
