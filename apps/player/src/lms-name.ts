/** Read only the server's supported display names. Old pages keep Moodle text. */
export function lmsName(element: Element | null): 'Moodle' | 'Canvas' | 'Blackboard' {
  const name = element?.getAttribute('data-lms-name');
  return name === 'Canvas' || name === 'Blackboard' ? name : 'Moodle';
}
