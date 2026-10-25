# ==============================================================================
# Multi-stage Dockerfile for Breachers.io Spring Boot Backend (Java 21)
# Optimized for Render, Railway, Fly.io, and Docker-based container platforms.
# ==============================================================================

# Stage 1: Build JAR using Maven
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder
WORKDIR /workspace/app

# Copy pom.xml and download dependencies (cached layer)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build production artifact
COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: Lightweight production JRE runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Create non-root system user for security
RUN addgroup -S breachers && adduser -S breachers -G breachers
USER breachers

# Copy repackaged JAR from builder stage
COPY --from=builder /workspace/app/target/breachers-backend-0.1.0-SNAPSHOT.jar app.jar

# Expose default backend port
EXPOSE 8081

# Configure container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8081}/api/health || exit 1

# Launch Spring Boot with container-aware JVM flags
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
