import { z } from 'zod';

/**
 * Environment configuration schema
 */
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().regex(/^\d+$/).transform(Number).default(8080),
    ODDSSHOPPER_API_URL: z.string().regex(/^https?:\/\/.+/),
});

export type Environment = z.infer<typeof envSchema>;

/**
 * Validates and parses environment variables
 *
 * @returns Validated environment configuration
 * @throws {Error} If validation fails
 */
export function validateEnvironment(): Environment {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const errors = result.error.issues.map(err =>
            `${err.path.join('.')}: ${err.message}`
        ).join('\n  ');

        throw new Error(`Environment validation failed:\n  ${errors}`);
    }

    return result.data;
}

/**
 * Gets the validated environment configuration
 * Safe to call after validateEnvironment() has been called once
 */
export function getEnvironment(): Environment {
    return envSchema.parse(process.env);
}
