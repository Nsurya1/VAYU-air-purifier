# ==============================================================================
# SOCHI VAYU - Spring Boot 3 Backend Multi-Stage Dockerfile
# Stage 1: Compile & Package with Maven on Temurin JDK 21
# Stage 2: Distroless/Minimal Temurin JRE 21 Runtime
# ==============================================================================

FROM maven:3.9-eclipse-temurin-21-alpine AS builder
WORKDIR /workspace

# Cache Maven dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B || true

# Compile and package application
COPY src ./src
RUN mvn clean package -DskipTests -B

# ------------------------------------------------------------------------------
# Runtime Image
# ------------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Non-root security user
RUN addgroup -S vayu && adduser -S vayu -G vayu
USER vayu

COPY --from=builder --chown=vayu:vayu /workspace/target/*.jar app.jar

EXPOSE 8080

# Production memory constraints for local host
ENV JAVA_OPTS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0"

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
