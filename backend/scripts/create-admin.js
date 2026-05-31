import "dotenv/config";
import { prisma } from "../src/prisma.js";
import { hashPassword } from "../src/auth.js";

function readArg(name) {
  var prefix = "--" + name + "=";
  var match = process.argv.slice(2).find(function (arg) {
    return arg.indexOf(prefix) === 0;
  });
  return match ? match.slice(prefix.length).trim() : "";
}

function readSetting(name, fallback) {
  return readArg(name) || process.env["ADMIN_" + name.toUpperCase()] || fallback || "";
}

async function main() {
  var username = readSetting("username", "admin").trim();
  var password = readSetting("password", "").trim();
  var displayName = readSetting("displayName", "Administrator").trim();

  if (!username) throw new Error("Admin username is required.");
  if (password.length < 8) throw new Error("Admin password must be at least 8 characters.");
  var passwordHash = await hashPassword(password);

  var role = await prisma.role.upsert({
    where: { code: "ADMIN" },
    update: {
      name: "Administrator",
      description: "System administrator"
    },
    create: {
      code: "ADMIN",
      name: "Administrator",
      description: "System administrator"
    }
  });

  var user = await prisma.user.upsert({
    where: { username: username },
    update: {
      displayName: displayName || null,
      passwordHash: passwordHash,
      passwordSalt: null,
      hashAlgorithm: "BCRYPT",
      hashIterations: null,
      isActive: true
    },
    create: {
      username: username,
      displayName: displayName || null,
      passwordHash: passwordHash,
      passwordSalt: null,
      hashAlgorithm: "BCRYPT",
      hashIterations: null,
      isActive: true
    }
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id
      }
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id
    }
  });

  console.log("Admin user is ready:", username);
}

main().catch(function (error) {
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
}).finally(async function () {
  await prisma.$disconnect();
});
