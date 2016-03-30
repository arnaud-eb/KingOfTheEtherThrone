/* jslint node:true */
'use strict';

/*
 * TODO - document
*/

function TestThronePayments() {
};

TestThronePayments.prototype.addTests = function(runner, throneSupport) {

  runner.addTest({
    title: 'Claim throne anonymously via fallback succeeds',
    categories: ['safe'],
    steps: [
      function(helper) {
        // given a new throne and a player:
        this.throne = throneSupport.createStandardTestThrone(helper);
        this.playerOneAccount = helper.account.createWithJustOver(helper.math.toWei('1', 'ether'));
      },
      function(helper) {
        // given that the  player claimed the throne by sending the starting price according
        // to the contract to the contract address:
        var claimPrice = this.throne.currentClaimPrice();
        helper.txn.send({
          from: this.playerOneAccount,
          to: this.throne.address,
          value: claimPrice,
          gas: 500000
        });
      },
      function(helper) {
        // then the claim price increases
        var newClaimPrice = this.throne.currentClaimPrice();
        helper.assert.equal(helper.math.toWei('1.5','ether'), newClaimPrice, 'expected new claim price to increase by 50%');
      }
    ]
  });

  runner.addTest({
    title: 'Claim throne anonymously via fallback using wallet contract succeeds',
    categories: ['safe'],
    steps: [
      function(helper) {
        // given a new throne and a player
        this.throne = throneSupport.createStandardTestThrone(helper);
        this.playerOneAccount = helper.account.createWithJustOver(helper.math.toWei('1.1', 'ether'));
      },
      function(helper) {
        // and given the player has their own wallet contract
        this.playerOneWallet = helper.txn.createContractInstance('DTRExpensiveWallet', [0], {
          from: this.playerOneAccount
        });
      },
      function(helper) {
        // and given that the player has sent money to their wallet:
        var claimPrice = this.throne.currentClaimPrice();
        helper.txn.send({
          from: this.playerOneAccount,
          to: this.playerOneWallet.address,
          value: claimPrice,
          gas: 500000
        });
      },
      function(helper) {
        // when the player instructs their wallet to send money to the throne,
        // specifying a decent wodge of gas:
        var extraGasAmount = 250000;
        var claimPrice = this.throne.currentClaimPrice();
        this.playerOneWallet.spendWithGas(this.throne.address, claimPrice, extraGasAmount, {
          from: this.playerOneAccount,
          gas: 500000
        });
      },
      function(helper) {
        // then the claim price increases
        var newClaimPrice = this.throne.currentClaimPrice();
        helper.assert.equal(helper.math.toWei('1500','finney'), newClaimPrice,
          'expected claim price to increase as normal when contract claims throne');
      }
    ]
  });

  runner.addTest({
    title: 'Compensation payment sent to king who claimed from cheap wallet contract',
    categories: ['safe'],
    steps: [
      function(helper) {
        // given a new throne and two players
        this.throne = throneSupport.createStandardTestThrone(helper);
        this.playerOneAccount = helper.account.createWithJustOver(helper.math.toWei('1', 'ether'));
        this.playerTwoAccount = helper.account.createWithJustOver(helper.math.toWei('1.5', 'ether'));
      },
      function(helper) {
        // and given the first player has their own wallet contract
        this.playerOneWallet = helper.txn.createContractInstance('DTRExpensiveWallet', [0], {
          from: this.playerOneAccount
        });
      },
      function(helper) {
        // and given that the first player has sent just enough money to their wallet to cover the claim price:
        var claimPrice = this.throne.currentClaimPrice();
        helper.txn.send({
          from: this.playerOneAccount,
          to: this.playerOneWallet.address,
          value: claimPrice,
          gas: 100000
        });
      },
      function(helper) {
        // when the player instructs their wallet to send money to the throne,
        // specifying a decent wodge of gas:
        var extraGasAmount = 250000;
        var claimPrice = this.throne.currentClaimPrice();
        this.playerOneWallet.spendWithGas(this.throne.address, claimPrice, extraGasAmount, {
          from: this.playerOneAccount,
          gas: 500000
        });
      },
      function(helper) {
        // then the claim price increases (and the player's wallet balance decreases)
        var newClaimPrice = this.throne.currentClaimPrice();
        helper.assert.equal(helper.math.toWei('1500','finney'), newClaimPrice,
          'expected claim price to increase as normal when contract claims throne');
        helper.assert.equal(0, helper.account.getBalance(this.playerOneWallet.address),
          'expected player one to spend all his money');
        // their non-wallet balance will have been charged for gas, make a note of it
        this.playerOneNonWalletBalanceAfterClaim = helper.account.getBalance(this.playerOneAccount);
        // and when the second player now claims the throne (not bothering with a wallet)
        this.throne.claimThrone('playerTwo', {
          from: this.playerTwoAccount,
          value: this.throne.currentClaimPrice(),
          gas: 500000
        });
      },
      function(helper) {
        // then playerOne's wallet receives 98% of the new claim price
        helper.assert.equal(helper.math.toWei('1.47','ether'), helper.account.getBalance(this.playerOneWallet.address),
          'expected player one wallet to receive compensation fee');
        // but their non-wallet account doesn't change
        helper.assert.equal(
          this.playerOneNonWalletBalanceAfterClaim,
          helper.account.getBalance(this.playerOneAccount),
          'only wallet balance should change');
        // and when we look in the hall of thrones then they are marked as compensated
        // note the origin vs the compensation address
        var firstMonarch = throneSupport.decodeMonarchArray(this.throne.monarchs(0), helper.txn.rawWeb3);
        helper.assert.equal(this.playerOneWallet.address, firstMonarch.compensationAddress, 'compensationAddress');
        helper.assert.equal(this.playerOneAccount, firstMonarch.originAddress, 'originAddress');
        var goodPaymentStatusCode = 1;
        helper.assert.equal(goodPaymentStatusCode, firstMonarch.compensationStatus, 'compensationStatus');
        helper.assert.equal(helper.math.toWei('1.47','ether'), firstMonarch.compensationPaid, 'compensationPaid');
      }
    ]
  });
  
};

exports = module.exports = TestThronePayments;