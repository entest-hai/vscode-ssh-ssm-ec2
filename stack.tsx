import { aws_ec2, aws_iam, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";

export class CdkVpcEndpointStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // create a new vpc with s3 endpoint
    const vpc = new aws_ec2.Vpc(this, "VpcWithS3Endpoint", {
      gatewayEndpoints: {
        S3: {
          service: aws_ec2.GatewayVpcEndpointAwsService.S3,
        },
      },
    });

    // add vpc endpoint ssm
    vpc.addInterfaceEndpoint("VpcIterfaceEndpointSSM", {
      service: aws_ec2.InterfaceVpcEndpointAwsService.SSM,
    });

    // role for ec2 to access s3
    const role = new aws_iam.Role(this, "RoleForEc2ToAccessS3", {
      roleName: "RoleForEc2ToAccessS3",
      assumedBy: new aws_iam.ServicePrincipal("ec2.amazonaws.com"),
    });
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

    // AmazonSSMManagedInstanceCore to communicate with SSM
    role.addManagedPolicy(
      aws_iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        "PolicySSMMangerAccessS3",
        "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
      )
    );

    // security group open port 22
    const sg = new aws_ec2.SecurityGroup(this, "SecurityGroupOpenPort22", {
      vpc,
      description: "allow port 22",
      allowAllOutbound: true,
    });

    // open port 22
    sg.addIngressRule(
      aws_ec2.Peer.anyIpv4(),
      aws_ec2.Port.tcp(22),
      "allow ssh from the world"
    );

    // open port 43
    sg.addIngressRule(
      aws_ec2.Peer.anyIpv4(),
      aws_ec2.Port.tcp(443),
      "allow port 443 from the world"
    );

    // ec2 instance in private subnet
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

    // ec2 in public subnet
    const ec2pub = new aws_ec2.Instance(this, "Ec2PublicSubnet", {
      role: role,
      keyName: "hai_ec2_t4g_large",
      vpc: vpc,
      instanceName: "Ec2PublicSubnet",
      instanceType: aws_ec2.InstanceType.of(
        aws_ec2.InstanceClass.T2,
        aws_ec2.InstanceSize.SMALL
      ),
      machineImage: aws_ec2.MachineImage.latestAmazonLinux(),
      securityGroup: sg,
      vpcSubnets: {
        subnetType: aws_ec2.SubnetType.PUBLIC,
      },
    });
  }
}
