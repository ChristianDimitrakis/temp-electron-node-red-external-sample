FROM electronuserland/builder:wine

COPY zscaler.pem zscaler.pem
COPY zscaler.crt zscaler.crt

RUN cp zscaler.crt /usr/local/share/ca-certificates
RUN cp zscaler.pem /usr/local/share/ca-certificates
RUN update-ca-certificates

RUN export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/zscaler.pem
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/zscaler.pem

WORKDIR electron-node-red

COPY main.js main.js
COPY package.json package.json
COPY flows.json flows.json
COPY build build
COPY console.htm console.htm
COPY nodered.png nodered.png
RUN yarn && yarn dist -w