# ADR-0010: GCP as the target cloud; M0 runs entirely locally

- Status: Accepted
- Date: 2026-11-20
- Tags: cloud, gcp, infra, deployment

## Context

One cloud avoids stacking IAM and billing. Development runs in GitHub Actions from M0.

## Decision

Target: Cloud Run (collector, api, projector job), Cloud SQL Postgres, MongoDB Atlas in a GCP region (Firestore with Mongo API evaluated), Pub/Sub, Secret Manager, Workload Identity Federation. No AWS. In M0 the runtime is local docker-compose and CI service containers.

## Alternatives considered

- Vercel for the collector: per-invocation pricing is a poor fit for tracking.
- AWS: a third cloud with no gain.

## Consequences

Deployment arrives in M1. No service-account keys in the repo.
