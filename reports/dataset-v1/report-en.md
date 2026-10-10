# Tunnel simulator dataset

{
  "planned": 3180,
  "completed": 3180,
  "failed": 0,
  "missing": 0,
  "invariant_checks": 4260,
  "invariant_failures": 0
}

## Development reference runs

| Model | Median RMSE (m) | P90 RMSE (m) | Worst RMSE (m) |
|---|---:|---:|---:|
| A | 158.24 | 1041.42 | 1192.66 |
| C | 49.31 | 135.38 | 416.24 |
| B | 15.99 | 43.27 | 105.30 |

A = constant speed, C = acceleration tracking Kalman, B = advanced IMM-EKF. All metrics in this table are run-level, tunnel-only; they are not pooled time samples.

## Interpretation

Use aggregates.csv for road/profile groups and effects.csv for paired parameter effects. Positive delta means the variant has larger error. Confidence intervals use 2,000 deterministic bootstrap resamples of seed clusters, preserving the three roads within a seed. These exploratory intervals are not adjusted for multiple comparisons. Do not interpret unchanged output as a failure when the relevant measurement is gated off or the event is absent. Longer calibration is not guaranteed to lower error. Calibration distance changes physical sensor history; comparisons at different distances are matched-seed scenarios, not identical recordings.

recovery_to_stable_10m_s is the first sample after physical exit whose absolute error remains <=10 m until recording ends (about 18 s later). Blank means right-censored; it is not zero or proof of never recovering. GNSS reacquisition may occur after physical exit. All-run peak includes approach and recovery and differs from tunnel-only peak. Readiness diagnostics are measured at the end of calibration, 200 m before entry.

## Files and reproducibility

manifest.json records engine source hashes, code revision, runtime and plan hash. plan.json contains full configurations and baseline pair IDs. runs/<id>.json stores full-precision metrics, configuration, calibration diagnostics, output fingerprints and a checksum for the time series. timeseries/<id>.csv.gz stores 10 Hz engine outputs, rounded to nine decimals; calibration rows are truth-only and missing fields stay blank. These are derived filter inputs, not the full raw 100 Hz three-axis phone stream. CSV t=0 is the end of calibration; elapsed_s includes calibration. No GUI playback settings influence these data.

Development seeds 1001–1020; untouched-parameter validation reference and predefined stress seeds 9001–9010. Validation results were not used to tune parameters. Stress cases alter multiple factors and cannot isolate individual causal effects. This is synthetic simulator validation, not evidence of real-phone accuracy. Full Cartesian interaction coverage is intentionally omitted.
