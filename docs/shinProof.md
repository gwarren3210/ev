# Proof: Equivalence of Shin and Additive Methods for $n=2$

This document outlines the proof that the Shin method is equivalent to the Additive method for a 2-sided market (where there are exactly two outcomes).
## 0. Deriving the Quadratic Form

The standard Shin estimator for true probability $p_i$ is expressed as:

$$
p_i = \frac{\sqrt{z^2 + 4(1-z) \frac{\pi_i^2}{\beta}} - z}{2(1-z)}
$$

To simplify the proof, we rearrange this into its quadratic origin. Multiply both sides by $2(1-z)$ and add $z$:

$$
2(1-z)p_i + z = \sqrt{z^2 + 4(1-z) \frac{\pi_i^2}{\beta}}
$$

Squaring both sides:

$$
4(1-z)^2 p_i^2 + 4(1-z)p_i z + z^2 = z^2 + 4(1-z) \frac{\pi_i^2}{\beta}
$$

Subtract $z^2$ from both sides and divide the entire equation by $4(1-z)$:

$$
(1-z)p_i^2 + zp_i = \frac{\pi_i^2}{\beta}
$$

$$
(1-z)p_i^2 + zp_i - \frac{\pi_i^2}{\beta} = 0
$$

This quadratic form is the starting point for our derivation in the following sections.

## 1. The Shin Model Definition

The Shin method relates the true probability $p_i$ to the implied probability $\pi_i$ (derived from odds) using the following quadratic relationship:

$$
(1-z)p_i^2 + zp_i - \frac{\pi_i^2}{\beta} = 0
$$

Where:
- $\beta = \sum \pi_i$ represents the sum of implied probabilities (book sum).
- $z$ is a parameter related to the proportion of insider trading.

## 2. The Two-Sided Market Case ($n=2$)

In a market with only two outcomes (e.g., a tennis match, coin toss, over/under), let the outcomes be 1 and 2. We have the following system of equations:

1. $(1-z)p_1^2 + zp_1 - \frac{\pi_1^2}{\beta} = 0$
2. $(1-z)p_2^2 + zp_2 - \frac{\pi_2^2}{\beta} = 0$

Additionally, in a 2-sided market, the probabilities must sum to 1:
$$
p_1 + p_2 = 1
$$

## 3. Derivation

Subtract equation (2) from equation (1):

$$
\left[ (1-z)p_1^2 + zp_1 \right] - \left[ (1-z)p_2^2 + zp_2 \right] = \frac{\pi_1^2}{\beta} - \frac{\pi_2^2}{\beta}
$$

Rearranging terms to group by $(1-z)$ and $z$:

$$
(1-z)(p_1^2 - p_2^2) + z(p_1 - p_2) = \frac{\pi_1^2 - \pi_2^2}{\beta}
$$

Apply the difference of squares identity, $(p_1^2 - p_2^2) = (p_1 - p_2)(p_1 + p_2)$:

$$
(1-z)(p_1 - p_2)(p_1 + p_2) + z(p_1 - p_2) = \frac{\pi_1^2 - \pi_2^2}{\beta}
$$

Substitute $p_1 + p_2 = 1$:

$$
(1-z)(p_1 - p_2)(1) + z(p_1 - p_2) = \frac{\pi_1^2 - \pi_2^2}{\beta}
$$

Factor out $(p_1 - p_2)$ on the left side:

$$
(p_1 - p_2)[(1-z) + z] = \frac{\pi_1^2 - \pi_2^2}{\beta}
$$

Simplify the term in the brackets $(1-z+z) = 1$:

$$
p_1 - p_2 = \frac{\pi_1^2 - \pi_2^2}{\beta}
$$

Since $\beta = \pi_1 + \pi_2$ for two outcomes, we can rewrite the right side using the difference of squares again:

$$
p_1 - p_2 = \frac{(\pi_1 - \pi_2)(\pi_1 + \pi_2)}{\pi_1 + \pi_2}
$$

Cancel $(\pi_1 + \pi_2)$:

$$
p_1 - p_2 = \pi_1 - \pi_2
$$

This result shows that the **difference between the true probabilities is identical to the difference between the bookmaker's implied probabilities.**

## 4. Solving for True Probability $p_1$

We now have a system of two linear equations for $p_1$ and $p_2$:
1. $p_1 + p_2 = 1$
2. $p_1 - p_2 = \pi_1 - \pi_2$

Substitute $p_2 = 1 - p_1$ into the second equation:

$$
p_1 - (1 - p_1) = \pi_1 - \pi_2
$$

$$
2p_1 - 1 = \pi_1 - \pi_2
$$

$$
p_1 = \frac{1 + \pi_1 - \pi_2}{2}
$$

Now, express $\pi_2$ in terms of $\beta$ and $\pi_1$. Since $\beta = \pi_1 + \pi_2$, we have $\pi_2 = \beta - \pi_1$. Substitute this back in:

$$
p_1 = \frac{1 + \pi_1 - (\beta - \pi_1)}{2}
$$

$$
p_1 = \frac{1 + 2\pi_1 - \beta}{2}
$$

$$
p_1 = \pi_1 - \frac{\beta - 1}{2}
$$

## 5. Conclusion

The "overround" or "vig" $W$ is defined as the excess probability above 1, so $W = \beta - 1$.
Substituting $W$ into the equation above yields the formula for the Additive Method:

$$
p_1 = \pi_1 - \frac{W}{2}
$$

Thus, for $n=2$, the Shin method simplifies directly to the Additive method, where the overround is distributed equally among the outcomes.