FROM electronuserland/builder:wine

RUN apt-get install git -y

RUN git clone https://github.com/dceejay/electron-node-red.git

COPY zscaler.pem zscaler.pem
COPY zscaler.crt zscaler.crt

RUN cp zscaler.crt /usr/local/share/ca-certificates
RUN cp zscaler.pem /usr/local/share/ca-certificates
RUN update-ca-certificates

RUN export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/zscaler.pem
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/zscaler.pem

WORKDIR electron-node-red

RUN yarn