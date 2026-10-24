# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
# This service uses Node built-ins and the shared browser data models only.
COPY --chown=node:node Backend/hub-server.cjs Backend/hub-store.cjs Backend/hub-rooms.cjs ./Backend/
COPY --chown=node:node Frontend/ ./Frontend/
RUN mkdir -p /var/lib/lauphim && chown node:node /var/lib/lauphim
ENV NODE_ENV=production HUB_HOST=0.0.0.0 HUB_PORT=8787 HUB_DATA_DIR=/var/lib/lauphim HUB_EPISODES_ENABLED=true
USER node
EXPOSE 8787
VOLUME ["/var/lib/lauphim"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+ (process.env.PORT || process.env.HUB_PORT || '8787') +'/api/hub/health',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "Backend/hub-server.cjs"]
