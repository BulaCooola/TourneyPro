"use client";
import { useFormState as useFormState } from "react-dom";
import { useState, useEffect } from "react";
import { addTeam } from "@/app/actions";
import Select from "react-select";
const initialState = {
  message: null,
};

function CreateTeam(props) {
  const [state, formAction] = useFormState(addTeam, initialState);
  const [users, setUsers] = useState(undefined);
  const [sports, setSports] = useState(undefined);
  const [countries, setCountries] = useState(undefined);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function fetchData() {
      const response1 = await fetch("/api/users");
      const users = await response1.json();
      let { userList } = users;
      const userOptions = [];
      for (let user of userList) {
        userOptions.push({
          value: user._id,
          label: `${user.firstName} ${user.lastName}`,
        });
      }
      setUsers(userOptions);

      const response2 = await fetch("/api/sports");
      const sports = await response2.json();
      setSports(sports.sports);

      const response3 = await fetch("/api/countries");
      const countries = await response3.json();
      setCountries(countries.countryListAlpha3);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (<div className="min-h-screen justify-between p-24 bg-base">
        <p>Loading</p>
        <p className="loading loading-dots loading-lg">Loading...</p>
      </div>)
  } else {
    return (
      <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-base">
        <form action={formAction} className="w-1/2 mx-auto my-20">
          {state && state.message && (
            <div className="alert alert-error w-1/2 mx-auto">
              <ul>
                {state.message.map((msg, index) => {
                  return (
                    <li className="error" key={index}>
                      {msg}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div>
            <label className="input input-bordered flex items-center gap-2 w-full max-w-xs mx-auto my-2">
              Name:
              <input name="name" id="name" type="text" placeholder="Team Name" required />
            </label>

            <div>
              <select
                className="select select-bordered flex w-full max-w-xs mx-auto my-2"
                name="sport"
                id="sport"
                required
              >
                <option defaultValue value="">
                  Select a sport...
                </option>
                {sports &&
                  sports.map((sport) => {
                    return (
                      <option key={sport} value={sport}>
                        {sport}
                      </option>
                    );
                  })}
              </select>
            </div>

            <select
              className="select select-bordered flex w-full max-w-xs mx-auto my-2"
              name="location"
              id="location"
              required
            >
              <option defaultValue value="">
                Select a location...
              </option>
              {countries &&
                Object.keys(countries).map((country) => {
                  return (
                    <option key={countries[country] + country} value={countries[country]}>
                      {countries[country]}
                    </option>
                  );
                })}
            </select>
            <div className="flex max-w-xs mx-auto my-2">
              {users && (
                <Select
                  placeholder="Select players for your new team..."
                  isMulti
                  options={users}
                  name="playerIds"
                  id="playerIds"
                ></Select>
              )}
            </div>

            <div className="form-group">
              <button className="btn btn-active btn-neutral flex mx-auto" type="submit">
                Create Team
              </button>
            </div>
          </div>
        </form>
      </main>
    );
  }
}

export default CreateTeam;
