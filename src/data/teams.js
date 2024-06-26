import { teams } from "@/config/mongoCollections.js";
import { ObjectId } from "mongodb";
import validation from "@/data/validation.js";
import userData from "@/data/users";
import { bracketData } from ".";
import { getRedisClient } from "@/data/redis-connect";

const exportedMethods = {
  async getAllTeams() {
    const client = await getRedisClient();
    const exists = await client.EXISTS("allTeams");
    if (exists) {
      const teamsString = await client.GET("allTeams");
      const teams = JSON.parse(teamsString);
      await client.disconnect();
      return teams;
    } else {
      const teamCollection = await teams();
      const teamList = await teamCollection.find({}).toArray();
      await client.SET("allTeams", JSON.stringify(teamList));
      await client.disconnect();
      return teamList;
    }
  },
  async getTeamById(id) {
    id = validation.checkId(id);
    const client = await getRedisClient();
    const exists = await client.EXISTS(`team/${id}`);
    if (exists) {
      const teamString = await client.GET(`team/${id}`);
      const team = JSON.parse(teamString);
      await client.disconnect();
      return team;
    } else {
      const teamCollection = await teams();
      const team = await teamCollection.findOne({ _id: new ObjectId(id) });
      if (!team) throw "Error: Team not found";
      await client.SET(`team/${id}`, JSON.stringify(team));
      await client.disconnect();
      return team;
    }
  },
  async getTeamsByPlayer(playerId) {
    playerId = validation.checkId(playerId);
    const client = await getRedisClient();
    const exists = await client.EXISTS(`teamsByPlayer/${playerId}`);
    if (exists) {
      const teamsString = await client.GET(`teamsByPlayer/${playerId}`);
      const teams = JSON.parse(teamsString);
      await client.disconnect();
      return teams;
    } else {
      const teamCollection = await teams();
      const teamList = await teamCollection
        .find({ playerIds: playerId })
        .toArray();
      await client.SET(`teamsByPlayer/${playerId}`, JSON.stringify(teamList));
      await client.disconnect();
      return teamList;
    }
  },
  async getTeamsByManager(managerId) {
    managerId = validation.checkId(managerId);
    const client = await getRedisClient();
    const exists = await client.EXISTS(`teamsByManager/${managerId}`);
    if (exists) {
      const teamsString = await client.GET(`teamsByManager/${managerId}`);
      const teams = JSON.parse(teamsString);
      await client.disconnect();
      return teams;
    } else {
      const teamCollection = await teams();
      const teamList = await teamCollection
        .find({ managerId: managerId })
        .toArray();
      await client.SET(`teamsByManager/${managerId}`, JSON.stringify(teamList));
      await client.disconnect();
      return teamList;
    }
  },
  async createTeam(name, sport, location, managerId, playerIds) {
    try {
      name = validation.checkString(name, "Team name");
      sport = validation.checkSport(sport);
      location = validation.checkLocation(location);
      await userData.getUserById(managerId.toString()); // Will throw error if managerId does not return a user
      await userData.checkIdArray(playerIds); //Will throw error if any vals in playerIds do not return a user
    } catch (e) {
      throw `Error: ${e}`;
    }

    let newTeam = {
      profilePicture: undefined,
      name: name,
      sport: sport,
      location: location,
      managerId: managerId,
      numPlayers: playerIds.length,
      playerIds: playerIds,
      numGames: 0,
      numWins: 0,
      numLosses: 0,
      tournamentsWon: 0,
      active: true,
    };

    const teamCollection = await teams();
    const newInsertInformation = await teamCollection.insertOne(newTeam);
    if (!newInsertInformation.insertedId) throw "Insert failed!";
    const team = await this.getTeamById(
      newInsertInformation.insertedId.toString()
    );
    const client = await getRedisClient();
    await client.FLUSHALL();
    await client.SET(`team/${team._id.toString()}`, JSON.stringify(team));
    await client.disconnect();
    return team;
  },
  async editTeam(teamId, updatedTeam) {
    // PATCH style

    // Check if team exists
    teamId = validation.checkId(teamId);
    const teamCollection = await teams();
    const team = await teamCollection.findOne({ _id: new ObjectId(teamId) });
    if (!team) throw "Error: Team not found";

    // Validate provided fields
    const updatedTeamData = {};
    if (updatedTeam.name) {
      updatedTeamData.name = validation.checkString(
        updatedTeam.name,
        "Team name"
      );
    }
    if (updatedTeam.sport) {
      updatedTeamData.sport = validation.checkSport(updatedTeam.sport);
    }
    if (updatedTeam.location) {
      updatedTeamData.location = validation.checkLocation(updatedTeam.location);
    }
    if (updatedTeam.managerId) {
      updatedTeam.managerId = validation.checkId(updatedTeam.managerId);
      const newManager = await userData.getUserById(updatedTeam.managerId);
      if (!newManager) throw "Error: User for manager not found";
      updatedTeamData.managerId = newManager._id.toString();
    }
    if (updatedTeam.playerIds) {
      updatedTeamData.playerIds = await userData.checkIdArray(
        updatedTeam.playerIds
      );
      updatedTeamData.numPlayers = updatedTeam.playerIds.length;
    }

    let newTeam = await teamCollection.findOneAndUpdate(
      { _id: new ObjectId(teamId) },
      { $set: updatedTeamData },
      { returnDocument: "after" }
    );

    if (!newTeam) throw `Could not update the team with id ${teamId}`;
    const client = await getRedisClient();
    await client.FLUSHALL();
    await client.SET(`team/${newTeam._id.toString()}`, JSON.stringify(newTeam));
    await client.disconnect();
    return newTeam;
  },
  async toggleActive(id) {
    id = validation.checkId(id);
    const teamCollection = await teams();
    const team = await this.getTeamById(id);
    if (!team) throw "Error: Could not get team.";
    delete team._id;
    team.active = !team.active;
    let newTeam = await teamCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: team },
      { returnDocument: "after" }
    );

    if (!newTeam) throw `Could not update the team with id ${id}`;
    const client = await getRedisClient();
    await client.FLUSHALL();
    await client.SET(`team/${newTeam._id.toString()}`, JSON.stringify(newTeam));
    await client.disconnect();
    return newTeam;
  },
  async checkIdArray(arr, bracketSize) {
    if (arr.length !== bracketSize)
      throw "Error: Number of teams provided does not match bracket size";

    if (!arr || !Array.isArray(arr)) throw `You must provide an array of Ids`;
    for (let i in arr) {
      try {
        await this.getTeamById(arr[i].toString());
      } catch (error) {
        throw `Error: ${error}`;
      }
    }

    return arr;
  },
  async addPlayer(teamId, playerId) {
    playerId = validation.checkId(playerId);
    const player = userData.getUserById(playerId);
    if (!player) throw `Error: Could not find user with id of ${playerId}`;

    teamId = validation.checkId(teamId);
    const team = this.getTeamById(teamId);
    if (!team) throw `Error: Could not find team with id of ${teamId}`;

    team.playerIds.push(playerId);
    team.numPlayers = team.playerIds.length;
    delete team._id;
    let newTeam = await teamCollection.findOneAndUpdate(
      { _id: new ObjectId(teamId) },
      { $set: team },
      { returnDocument: "after" }
    );

    if (!newTeam) throw `Could not update the team with id ${teamId}`;
    const client = await getRedisClient();
    await client.FLUSHALL();
    await client.SET(`team/${newTeam._id.toString()}`, JSON.stringify(newTeam));
    await client.disconnect();
    return newTeam;
  },
  async addWin(id) {
    id = validation.checkId(id);
    const team = await this.getTeamById(id);
    if (!team) throw "Error: Could not find team";
    const teamCollection = await teams();
    const update = {};
    update.numGames = team.numGames + 1;
    update.numWins = team.numWins + 1;
    let newTeam = await teamCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: "after" }
    );
    if (!newTeam) throw `Could not update the team with id ${id}`;
    const client = await getRedisClient();
    await client.FLUSHALL();
    await client.SET(`team/${newTeam._id.toString()}`, JSON.stringify(newTeam));
    await client.disconnect();
    return newTeam;
  },
  async addLoss(id) {
    id = validation.checkId(id);
    const team = await this.getTeamById(id);
    if (!team) throw "Error: Could not find team";
    const teamCollection = await teams();
    const update = {};
    update.numGames = team.numGames + 1;
    update.numLosses = team.numLosses + 1;
    let newTeam = await teamCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: "after" }
    );
    if (!newTeam) throw `Could not update the team with id ${id}`;
    const client = await getRedisClient();
    await client.FLUSHALL();
    await client.SET(`team/${newTeam._id.toString()}`, JSON.stringify(newTeam));
    await client.disconnect();
    return newTeam;
  },
  async getTeamsPlayers(teamId) {
    const team = await this.getTeamById(teamId);
    if (!team) throw "Error: Could not get team.";
    const players = await userData.getListOfPlayers(team.playerIds);
    if (!players) throw `Error: Could not get team players.`;
    return players;
  },
  async getListofTeams(arr, size) {
    arr = await this.checkIdArray(arr, size);
    for (let i in arr) {
      arr[i] = new ObjectId(arr[i]);
    }
    const teamCollection = await teams();
    const teamList = await teamCollection.find({ _id: { $in: arr } }).toArray();
    return teamList;
  },
  async getTeamsBySport(sport) {
    sport = validation.checkSport(sport);
    const teamCollection = await teams();
    const teamList = await teamCollection.find({ sport: sport }).toArray();
    return teamList;
  },
  async teamsMatchSport(idArr, sport) {
    sport = validation.checkSport(sport);
    for (let teamId of idArr) {
      let team = await this.getTeamById(teamId);
      if (!team) throw "Error: Could not find team.";
      if (team.sport !== sport) {
        throw `Error: ${team.name} is a ${team.sport} team and cannot be added to a ${sport} tournament.`;
      }
    }
    return idArr;
  },
};

export default exportedMethods;
