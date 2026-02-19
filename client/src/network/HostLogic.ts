export function applyInputInOrder(
  state: { lastSeq: number; x: number; y: number },
  input: { seq: number; dx: number; dy: number }
) {
  if (input.seq <= state.lastSeq) {
    return state;
  }

  return {
    ...state,
    lastSeq: input.seq,
    x: state.x + input.dx,
    y: state.y + input.dy,
  };
}
