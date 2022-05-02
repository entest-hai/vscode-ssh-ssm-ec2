# Setup vscode ssh remote to a private EC2 instance via ssm

**Summary**

With AWS system manager (SSM), it is possible to setup vscode ssh remote to a EC2 in a private subnet, and without open 22 port. In this note,

- Setup a connection to a private EC2 via SSM
- Setup vscode ssh remote to the EC2 by [**proxyCommand**](https://github.com/aws-samples/cloud9-to-power-vscode-blog/blob/main/scripts/ssm-proxy.sh)
- Create the infrastructure by a CDK stack

**Reference**

- [vscode cloud9 setup](https://aws.amazon.com/blogs/architecture/field-notes-use-aws-cloud9-to-power-your-visual-studio-code-ide/)
- [SSM VPC endpoint](https://docs.aws.amazon.com/systems-manager/latest/userguide/setup-create-vpc.html)
- [aws ssm start-session](https://docs.aws.amazon.com/cli/latest/reference/ssm/start-session.html)

### Architecture
![aws_devops-Expriment drawio](https://user-images.githubusercontent.com/20411077/166241577-87e23a4b-5e98-443d-b115-ff9c271fa603.png)

### CDK Stack

create a VPC with a S3 VPC endpoint

```tsx
const vpc = new aws_ec2.Vpc(this, "VpcWithS3Endpoint", {
  gatewayEndpoints: {
    S3: {
      service: aws_ec2.GatewayVpcEndpointAwsService.S3,
    },
  },
});
```

add system manager VPC interface endpoint

```tsx
vpc.addInterfaceEndpoint("VpcIterfaceEndpointSSM", {
  service: aws_ec2.InterfaceVpcEndpointAwsService.SSM,
});
```

create an IAM role for the EC2

```tsx
const role = new aws_iam.Role(this, "RoleForEc2ToAccessS3", {
  roleName: "RoleForEc2ToAccessS3",
  assumedBy: new aws_iam.ServicePrincipal("ec2.amazonaws.com"),
});
```

role for EC2 to communicate with SSM

```tsx
role.addManagedPolicy(
  aws_iam.ManagedPolicy.fromManagedPolicyArn(
    this,
    "PolicySSMMangerAccessS3",
    "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  )
);
```

policy for EC2 to access S3

```tsx
role.attachInlinePolicy(
  new aws_iam.Policy(this, "PolicyForEc2AccessS3", {
    policyName: "PolicyForEc2AccessS3",
    statements: [
      new aws_iam.PolicyStatement({
        actions: ["s3:*"],
        resources: ["*"],
      }),
    ],
  })
);
```

launch an EC2 in a private subnet

```tsx
const ec2 = new aws_ec2.Instance(this, "Ec2ConnectVpcEndpointS3", {
  role: role,
  keyName: "hai_ec2_t4g_large",
  vpc: vpc,
  instanceName: "Ec2ConnectVpcEndpointS3",
  instanceType: aws_ec2.InstanceType.of(
    aws_ec2.InstanceClass.T2,
    aws_ec2.InstanceSize.SMALL
  ),
  machineImage: aws_ec2.MachineImage.latestAmazonLinux(),
  securityGroup: sg,
  vpcSubnets: {
    subnetType: aws_ec2.SubnetType.PRIVATE,
  },
});
```

### Setup a connection to private EC2 via SSM

[follow this to](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) install ssm plugin for the local machine

start a ssm session from the local machine

```console
aws ssm start-session --target "EC2-INSTANCE-ID"
```

### Setup vscode ssh remote to the EC2

[follow this to ](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) install ssh remote extension for vscode

generate SSH key pair from the local machine

```console
ssh-keygen -b 4096 -C 'VS Code Remote SSH user' -t rsa
```

configure the ~/.ssh/config file

```bash
Host ssm-private-ec2
  IdentityFile ~/.ssh/id_rsa
  HostName i-026bb5f5caaf16aa1
  User ec2-user
  ProxyCommand sh -c "~/.ssh/ssm-private-ec2-proxy.sh %h %p"
```

create a ssm-private-ec2-proxy.sh file

```bash
#!/bin/bash

AWS_PROFILE=''
AWS_REGION=''
MAX_ITERATION=5
SLEEP_DURATION=5

# Arguments passed from SSH client
HOST=$1
PORT=$2

echo $HOST

# Start ssm session
aws ssm start-session --target $HOST \
  --document-name AWS-StartSSHSession \
  --parameters portNumber=${PORT} \
  --profile ${AWS_PROFILE} \
  --region ${AWS_REGION}
```

vscode will create a ssh connection to the EC2 via the **ProxyCommand** script which creates a SSM session under the hood. This is the way [vscode ssh remote with cloud9 works](https://aws.amazon.com/blogs/architecture/field-notes-use-aws-cloud9-to-power-your-visual-studio-code-ide/)

### Configure vscode ssh

keep alive settings.json

```json
{
  "remote.SSH.connectTimeout": 60
}
```

- [further customiation](https://code.visualstudio.com/blogs/2019/10/03/remote-ssh-tips-and-tricks)
