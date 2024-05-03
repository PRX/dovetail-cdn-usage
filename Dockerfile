FROM public.ecr.aws/lambda/nodejs:20

LABEL maintainer="PRX <sysadmin@prx.org>"
LABEL org.prx.spire.publish.s3="LAMBDA_ZIP"

WORKDIR /app

ENTRYPOINT [ "yarn", "run" ]
CMD [ "test" ]

RUN dnf install -y rsync zip tar xz && dnf clean all && rm -rf /var/cache/dnf
ADD yarn.lock ./
ADD package.json ./
RUN yarn install
ADD . .
RUN yarn run build
