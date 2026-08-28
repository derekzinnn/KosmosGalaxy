import { z } from 'zod';

/**
 * A heartbeat from the player.
 *
 * The position is validated as a plausible number and nothing more. It is not
 * trusted — `applyHeartbeat` clamps it against the real duration and against
 * the wall clock, because a client can report anything and this schema can
 * only tell that it is a number. The upper bound is twenty-four hours: not a
 * security boundary, just a floor under how absurd a value can get before it
 * is refused outright rather than silently clamped.
 */
export const heartbeatSchema = z.object({
  positionSeconds: z.coerce
    .number({ message: 'Informe a posição em segundos' })
    .finite('Posição inválida')
    .min(0, 'A posição não pode ser negativa')
    .max(60 * 60 * 24, 'Posição inválida'),
});

export type HeartbeatBody = z.infer<typeof heartbeatSchema>;

/** The complete button reports where the player had reached, same shape. */
export const completeSchema = heartbeatSchema;
export type CompleteBody = z.infer<typeof completeSchema>;
