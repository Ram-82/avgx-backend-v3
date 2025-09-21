
import { expect } from "chai";
import { ethers } from "hardhat";
import { AVGXToken, AVGXAccessController } from "../typechain-types";

describe("AVGXToken", function () {
  let token: AVGXToken;
  let accessController: AVGXAccessController;
  let owner: any, minter: any, user: any;

  beforeEach(async function () {
    [owner, minter, user] = await ethers.getSigners();

    // Deploy Access Controller
    const AccessController = await ethers.getContractFactory("AVGXAccessController");
    accessController = await AccessController.deploy(owner.address);

    // Deploy Token
    const Token = await ethers.getContractFactory("AVGXToken");
    token = await Token.deploy(await accessController.getAddress());

    // Grant minter role
    const MINTER_ROLE = await token.MINTER_ROLE();
    await accessController.grantRole(MINTER_ROLE, minter.address);
  });

  describe("Deployment", function () {
    it("Should have correct name and symbol", async function () {
      expect(await token.name()).to.equal("AVGX");
      expect(await token.symbol()).to.equal("AVGX");
    });

    it("Should have 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });

    it("Should start with zero supply", async function () {
      expect(await token.totalSupply()).to.equal(0);
    });
  });

  describe("Minting", function () {
    it("Should allow minter to mint tokens", async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(minter).mint(user.address, amount);
      
      expect(await token.balanceOf(user.address)).to.equal(amount);
      expect(await token.totalSupply()).to.equal(amount);
    });

    it("Should emit Minted event", async function () {
      const amount = ethers.parseEther("1000");
      await expect(token.connect(minter).mint(user.address, amount))
        .to.emit(token, "Minted")
        .withArgs(user.address, amount);
    });

    it("Should revert if non-minter tries to mint", async function () {
      const amount = ethers.parseEther("1000");
      await expect(token.connect(user).mint(user.address, amount))
        .to.be.reverted;
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(minter).mint(user.address, amount);
    });

    it("Should allow burning own tokens", async function () {
      const burnAmount = ethers.parseEther("500");
      await token.connect(user).burn(burnAmount);
      
      expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("500"));
    });

    it("Should allow burning with allowance", async function () {
      const burnAmount = ethers.parseEther("500");
      await token.connect(user).approve(minter.address, burnAmount);
      await token.connect(minter).burnFrom(user.address, burnAmount);
      
      expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("500"));
    });

    it("Should emit Burned event", async function () {
      const burnAmount = ethers.parseEther("500");
      await expect(token.connect(user).burn(burnAmount))
        .to.emit(token, "Burned")
        .withArgs(user.address, burnAmount);
    });
  });

  describe("Max Supply", function () {
    it("Should allow governor to set max supply once", async function () {
      const maxSupply = ethers.parseEther("1000000");
      const GOVERNOR_ROLE = await accessController.GOVERNOR_ROLE();
      
      await token.setMaxSupply(maxSupply);
      expect(await token.maxSupply()).to.equal(maxSupply);
    });

    it("Should revert if max supply is set twice", async function () {
      const maxSupply = ethers.parseEther("1000000");
      await token.setMaxSupply(maxSupply);
      
      await expect(token.setMaxSupply(maxSupply))
        .to.be.revertedWithCustomError(token, "MaxSupplyAlreadySet");
    });

    it("Should revert minting beyond max supply", async function () {
      const maxSupply = ethers.parseEther("1000");
      await token.setMaxSupply(maxSupply);
      
      await expect(token.connect(minter).mint(user.address, ethers.parseEther("1001")))
        .to.be.revertedWithCustomError(token, "MaxSupplyExceeded");
    });
  });

  describe("Pausing", function () {
    it("Should allow pauser to pause transfers", async function () {
      const PAUSER_ROLE = await accessController.PAUSER_ROLE();
      await accessController.grantRole(PAUSER_ROLE, owner.address);
      
      await token.connect(minter).mint(user.address, ethers.parseEther("1000"));
      await token.pause();
      
      await expect(token.connect(user).transfer(minter.address, ethers.parseEther("100")))
        .to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("Should allow pauser to unpause transfers", async function () {
      const PAUSER_ROLE = await accessController.PAUSER_ROLE();
      await accessController.grantRole(PAUSER_ROLE, owner.address);
      
      await token.connect(minter).mint(user.address, ethers.parseEther("1000"));
      await token.pause();
      await token.unpause();
      
      await expect(token.connect(user).transfer(minter.address, ethers.parseEther("100")))
        .to.not.be.reverted;
    });
  });
});
