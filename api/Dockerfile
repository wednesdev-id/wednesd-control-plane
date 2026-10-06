FROM ubuntu:24.04
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY target/release/wednes-cp-api /app/
EXPOSE 3000
CMD ["./wednes-cp-api"]
