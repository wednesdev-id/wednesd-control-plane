FROM rust:1.99.0-alpine AS builder
RUN apk add --no-cache musl-dev
WORKDIR /usr/src/wednes-cp-api
COPY . .
RUN cargo build --release

FROM alpine:latest
WORKDIR /app
COPY --from=builder /usr/src/wednes-cp-api/target/release/wednes-cp-api /app/
EXPOSE 3000
CMD ["./wednes-cp-api"]
